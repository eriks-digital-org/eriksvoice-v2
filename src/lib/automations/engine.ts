import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { callOut, outboundNumberFor } from "@/lib/agents/phones";
import { sendSms } from "@/lib/telephony/twilio";
import { sendMail } from "@/lib/notify/mail";
import { notify } from "@/lib/notify";
import { getSecret } from "@/lib/providers/secrets";
import { inWindow, israelNow } from "@/lib/time";
import * as crm from "@/lib/crm/erikscrm";
import { render, type AutomationSpec, type TriggerType } from "./catalog";

type Db = ReturnType<typeof createAdminClient>;

/** What happened. `contact` is the person the actions are about, when there is one. */
export interface AutomationEvent {
  type: TriggerType;
  clientId: string;
  /** Stable id of what happened (call id, lead id + status, webhook id…), for de-duplication. */
  key: string;
  contact?: { name?: string; phone?: string; email?: string; leadId?: string };
  call?: { id: string; direction: string; outcome: string; summary: string; duration: number; agentName?: string; startedAt?: string };
  /** crm_status (and leads that came from the CRM) */
  crm?: { leadId: string; status?: string; previousStatus?: string };
  lead?: { id: string; tags: string[] };
  /** webhook_in */
  name?: string;
  data?: Record<string, unknown>;
}

const MAX_ATTEMPTS = 3;
const DEDUP_HOURS = 24;
const BUSINESS = { days: [0, 1, 2, 3, 4], start_minute: 8 * 60, end_minute: 19 * 60 };

const toMinute = (hhmm?: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

function hoursOk(spec: AutomationSpec, at = new Date()): boolean {
  const h = spec.hours ?? { mode: "always" };
  if (h.mode === "business") return inWindow(BUSINESS, at);
  if (h.mode === "after") return !inWindow(BUSINESS, at);
  if (h.mode === "custom") {
    const start = toMinute(h.start) ?? 0;
    const end = toMinute(h.end) ?? 1440;
    return inWindow({ days: h.days?.length ? h.days : [0, 1, 2, 3, 4, 5, 6], start_minute: start, end_minute: end }, at);
  }
  return true;
}

function matches(spec: AutomationSpec, e: AutomationEvent): boolean {
  const t = spec.trigger;
  if (t.type !== e.type) return false;
  const c = t.config ?? {};
  if (e.type === "call_ended" && e.call) {
    if (c.direction && c.direction !== "any" && c.direction !== e.call.direction) return false;
    if (c.outcome && c.outcome !== "any" && c.outcome !== e.call.outcome) return false;
  }
  if (e.lead && c.tag && !e.lead.tags.includes(c.tag)) return false;
  if (e.type === "webhook_in" && c.event && c.event !== e.name) return false;
  if (e.type === "crm_status" && c.status && c.status.trim() !== (e.crm?.status ?? "")) return false;
  return true;
}

/** Queues the matching automations of a client for an event. Never throws. */
export async function emit(e: AutomationEvent): Promise<void> {
  try {
    const db = createAdminClient();
    const { data: client } = await db.from("clients").select("status").eq("id", e.clientId).maybeSingle();
    if (!client || client.status === "paused") return;
    const { data } = await db.from("automations").select("id, spec").eq("client_id", e.clientId).eq("enabled", true);
    for (const a of data ?? []) {
      const spec = a.spec as AutomationSpec;
      if (!matches(spec, e)) continue;
      if (!hoursOk(spec)) continue;
      await enqueue(db, a.id, e, spec.delay_minutes ?? 0);
    }
  } catch (err) {
    console.error("automations emit", err);
  }
}

async function enqueue(db: Db, automationId: string, e: AutomationEvent, delayMinutes: number) {
  // The same thing never runs the same automation twice within 24 hours.
  const since = new Date(Date.now() - DEDUP_HOURS * 3600_000).toISOString();
  const { count } = await db
    .from("automation_runs")
    .select("id", { count: "exact", head: true })
    .eq("automation_id", automationId)
    .eq("dedup_key", e.key)
    .gte("created_at", since);
  if (count) return;
  await db.from("automation_runs").insert({
    automation_id: automationId,
    client_id: e.clientId,
    event: e,
    dedup_key: e.key,
    run_at: new Date(Date.now() + Math.max(0, delayMinutes) * 60_000).toISOString(),
  });
}

/** Scheduled triggers (daily / weekly): queued once a day at their minute. */
async function enqueueScheduled(db: Db) {
  const { day, minute } = israelNow();
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const { data } = await db.from("automations").select("id, client_id, spec").eq("enabled", true).in("spec->trigger->>type", ["daily", "weekly"]);
  for (const a of data ?? []) {
    const spec = a.spec as AutomationSpec;
    const at = toMinute(spec.trigger.config?.time) ?? 9 * 60;
    if (at !== minute) continue;
    if (spec.trigger.type === "weekly" && (spec.trigger.config?.day ?? 0) !== day) continue;
    await enqueue(db, a.id, { type: spec.trigger.type, clientId: a.client_id, key: `${spec.trigger.type}:${date}` }, spec.delay_minutes ?? 0);
  }
}

interface Ctx {
  runId: string;
  db: Db;
  clientId: string;
  client: { name: string; slug: string };
  spec: AutomationSpec;
  event: AutomationEvent;
  vars: Record<string, string>;
}

async function report(ctx: Ctx): Promise<string> {
  const days = ctx.event.type === "weekly" ? 7 : 1;
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const [{ data: calls }, { count: newLeads }] = await Promise.all([
    ctx.db.from("calls").select("direction, outcome, duration_secs").eq("client_id", ctx.clientId).gte("started_at", since),
    ctx.db.from("leads").select("id", { count: "exact", head: true }).eq("client_id", ctx.clientId).gte("created_at", since),
  ]);
  const list = calls ?? [];
  const minutes = Math.ceil(list.reduce((s, c) => s + (c.duration_secs as number), 0) / 60);
  const text = [
    `${days === 1 ? "סיכום יומי" : "סיכום שבועי"} – ${ctx.client.name}`,
    `שיחות: ${list.length} (נכנסות ${list.filter((c) => c.direction === "inbound").length}, יוצאות ${list.filter((c) => c.direction === "outbound").length})`,
    `שיחות שהצליחו: ${list.filter((c) => c.outcome === "success").length}`,
    `דקות: ${minutes}`,
    `לידים חדשים: ${newLeads ?? 0}`,
  ].join("\n");
  await notify({ clientId: ctx.clientId, kind: "report", title: text.split("\n")[0], body: text.split("\n").slice(1).join(" · "), link: `/${ctx.client.slug}/calls`, email: true });
  return "הדוח נשלח";
}

async function activepieces(ctx: Ctx, config: Record<string, string>): Promise<string> {
  const { data: conn } = await ctx.db.from("connections").select("flow_url").eq("client_id", ctx.clientId).eq("kind", "activepieces").maybeSingle();
  const url = (conn as { flow_url?: string } | null)?.flow_url;
  if (!url) throw new Error("ללקוח עוד אין תהליך ב־Activepieces");
  const params = Object.fromEntries(
    (config.params ?? "")
      .split("\n")
      .map((l) => l.split("="))
      .filter((p) => p.length >= 2 && p[0].trim())
      .map(([k, ...v]) => [k.trim(), render(v.join("=").trim(), ctx.vars)]),
  );
  const body = JSON.stringify({ action: config.action, client: ctx.client.slug, params, event: ctx.event });
  const secret = await getSecret("activepieces_signing_secret");
  const ts = Math.floor(Date.now() / 1000).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-EriksVoice-Timestamp": ts, "X-EriksVoice-Signature": createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex") } : {}),
    },
    body,
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res?.ok) throw new Error(`Activepieces החזיר ${res?.status ?? "בלי תשובה"}`);
  return `נשלח ל־Activepieces (${config.action})`;
}

/** The CRM card this run is about: from the event, or found / created by phone. */
async function crmLead(ctx: Ctx): Promise<string> {
  if (ctx.event.crm?.leadId) return ctx.event.crm.leadId;
  const phone = ctx.vars.phone;
  if (!phone) throw new Error("אין מספר טלפון לחיפוש ב־CRM");
  const lead = await crm.ensureLead(ctx.clientId, phone, ctx.vars.name, `ev-${ctx.runId}-lead`);
  ctx.event.crm = { leadId: lead.id, status: lead.status ?? undefined };
  return lead.id;
}

/** Idempotency key for a CRM write of one action of one run (the same on a retry). */
const crmKey = (ctx: Ctx, i: number, what: string) => `ev-${ctx.runId}-${i}-${what}`;

async function crmLogCall(ctx: Ctx, i: number, c: Record<string, string>): Promise<string> {
  const call = ctx.event.call;
  if (!call) throw new Error("האוטומציה לא התחילה משיחה");
  const leadId = await crmLead(ctx);
  const { data: row } = await ctx.db.from("calls").select("transcript, started_at").eq("provider_conversation_id", call.id).maybeSingle();
  const turns = ((row?.transcript as { role: string; text: string }[] | undefined) ?? []).map((t) => `${t.role === "agent" ? "סוכן" : "לקוח"}: ${t.text}`);
  await crm.addActivity(
    ctx.clientId,
    leadId,
    {
      type: "call",
      direction: call.direction === "outbound" ? "outbound" : "inbound",
      occurred_at: (row?.started_at as string | undefined) ?? call.startedAt ?? new Date().toISOString(),
      duration_seconds: Math.min(86400, Math.max(0, Math.round(call.duration))),
      outcome: "answered",
      agent_name: (call.agentName || "סוכן קולי").slice(0, 200),
      summary: (call.summary || "אין סיכום").slice(0, 10000),
      transcript: (turns.join("\n") || "אין תמליל").slice(0, 200000),
      external_call_id: call.id,
    },
    crmKey(ctx, i, "call"),
  );
  if (c.tag?.trim()) await crm.updateLead(ctx.clientId, leadId, { tags_add: [render(c.tag, ctx.vars).trim()] }, crmKey(ctx, i, "tag"));
  return "השיחה נרשמה בכרטיס הליד ב־CRM";
}

async function runAction(ctx: Ctx, a: AutomationSpec["actions"][number], i: number): Promise<string> {
  const c = a.config ?? {};
  const phone = ctx.vars.phone;
  switch (a.type) {
    case "call_now": {
      if (!ctx.spec.agent_id) throw new Error("לא נבחר סוכן");
      if (!phone) throw new Error("אין מספר טלפון");
      const r = await callOut(ctx.spec.agent_id, phone, { name: ctx.vars.name, lead_name: ctx.vars.name });
      if (!r.ok) throw new Error(r.error);
      return `השיחה יצאה מ־${r.from}`;
    }
    case "sms": {
      if (!ctx.spec.agent_id) throw new Error("לא נבחר סוכן");
      if (!phone) throw new Error("אין מספר טלפון");
      const from = await outboundNumberFor(ctx.spec.agent_id);
      if (!from) throw new Error("ללקוח אין מספר טלפון");
      await sendSms(from.e164, phone, render(c.text ?? "", ctx.vars));
      return `SMS נשלח ל־${phone}`;
    }
    case "email_contact": {
      if (!ctx.vars.email) throw new Error("אין כתובת מייל");
      const ok = await sendMail([ctx.vars.email], render(c.subject || ctx.client.name, ctx.vars), render(c.text ?? "", ctx.vars));
      if (!ok) throw new Error("שליחת המייל נכשלה");
      return `מייל נשלח ל־${ctx.vars.email}`;
    }
    case "notify_team": {
      const text = render(c.text || "{{name}} {{phone}}\n{{summary}}", ctx.vars).trim();
      await notify({ clientId: ctx.clientId, kind: "automation", title: text.split("\n")[0] || "התראה", body: text.split("\n").slice(1).join("\n"), link: `/${ctx.client.slug}/calls`, email: true });
      return "הצוות קיבל התראה";
    }
    case "report":
      return report(ctx);
    case "lead_tag": {
      const leadId = ctx.event.contact?.leadId;
      if (!leadId) throw new Error("אין ליד");
      const { data: lead } = await ctx.db.from("leads").select("tags, status").eq("id", leadId).single();
      const tags = [...new Set([...((lead?.tags as string[]) ?? []), c.tag].filter(Boolean))];
      const queue = /^(כן|yes|1|true)$/i.test((c.queue ?? "").trim()) && lead?.status !== "calling" && lead?.status !== "dnc";
      await ctx.db.from("leads").update({ tags, ...(queue ? { status: "queued", next_attempt_at: null, attempts: 0 } : {}) }).eq("id", leadId);
      return `הליד עבר לתיקייה ${c.tag}${queue ? " ונכנס לתור" : ""}`;
    }
    case "webhook": {
      if (!/^https:\/\//.test(c.url ?? "")) throw new Error("כתובת לא תקינה");
      const res = await fetch(c.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: ctx.event.type, client: ctx.client.slug, ...ctx.vars, data: ctx.event.data ?? null }),
        signal: AbortSignal.timeout(15_000),
      }).catch(() => null);
      if (!res?.ok) throw new Error(`הכתובת החזירה ${res?.status ?? "בלי תשובה"}`);
      return "נשלח";
    }
    case "activepieces":
      return activepieces(ctx, c);
    case "crm_log_call":
      return crmLogCall(ctx, i, c);
    case "crm_status": {
      const leadId = await crmLead(ctx);
      const body: Record<string, unknown> = {};
      const status = render(c.status ?? "", ctx.vars).trim();
      const tag = render(c.tag ?? "", ctx.vars).trim();
      if (status) body.status = status;
      if (tag) body.tags_add = [tag];
      if (!status && !tag) throw new Error("לא נבחר סטטוס או תגית");
      await crm.updateLead(ctx.clientId, leadId, body, crmKey(ctx, i, "update"));
      return `הליד עודכן ב־CRM${status ? ` לסטטוס ${status}` : ""}`;
    }
    case "crm_note": {
      const leadId = await crmLead(ctx);
      const note = render(c.text ?? "", ctx.vars).trim();
      if (!note) throw new Error("ההערה ריקה");
      await crm.addNote(ctx.clientId, leadId, note.slice(0, 10000), crmKey(ctx, i, "note"));
      return "נוספה הערה ב־CRM";
    }
    case "crm_task": {
      const leadId = await crmLead(ctx);
      const hours = Math.min(24 * 60, Math.max(0, Number(c.hours) || 24));
      await crm.addTask(
        ctx.clientId,
        leadId,
        {
          title: (render(c.title ?? "", ctx.vars).trim() || `לחזור אל ${ctx.vars.name || ctx.vars.phone}`).slice(0, 200),
          starts_at: new Date(Date.now() + hours * 3600_000).toISOString(),
          duration_seconds: 1800,
          kind: /פגיש|meeting/i.test(c.kind ?? "") ? "meeting" : "task",
          ...(c.note?.trim() ? { note: render(c.note, ctx.vars).slice(0, 10000) } : {}),
        },
        crmKey(ctx, i, "task"),
      );
      return "נפתחה משימה ב־CRM";
    }
  }
}

async function runOne(db: Db, run: { id: string; automation_id: string; client_id: string; event: AutomationEvent; attempts: number; log: unknown[] }) {
  const { data: a } = await db.from("automations").select("enabled, spec").eq("id", run.automation_id).maybeSingle();
  if (!a?.enabled) {
    await db.from("automation_runs").update({ status: "skipped", finished_at: new Date().toISOString(), last_error: "האוטומציה כבויה" }).eq("id", run.id);
    return;
  }
  const spec = a.spec as AutomationSpec;
  const { data: client } = await db.from("clients").select("name, slug, status").eq("id", run.client_id).single();
  if (client?.status === "paused") {
    await db.from("automation_runs").update({ status: "skipped", finished_at: new Date().toISOString(), last_error: "הלקוח מושהה" }).eq("id", run.id);
    return;
  }
  const e = run.event;
  const vars: Record<string, string> = {
    name: e.contact?.name ?? "",
    phone: e.contact?.phone ?? "",
    email: e.contact?.email ?? "",
    summary: e.call?.summary ?? "",
    agent: e.call?.agentName ?? "",
    business: client?.name ?? "",
    direction: e.call ? ({ inbound: "נכנסת", outbound: "יוצאת", web: "דפדפן" } as Record<string, string>)[e.call.direction] ?? "" : "",
    duration: e.call ? `${Math.round(e.call.duration / 60)} דק׳` : "",
    date: new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }),
    crm_status: e.crm?.status ?? "",
  };
  for (const [k, v] of Object.entries(e.data ?? {})) if (!(k in vars) && (typeof v === "string" || typeof v === "number")) vars[k] = String(v);
  const ctx: Ctx = { runId: run.id, db, clientId: run.client_id, client: client ?? { name: "", slug: "" }, spec, event: e, vars };

  // Actions that already succeeded in an earlier attempt are not repeated.
  const done = new Set((run.log as { i: number; ok: boolean }[]).filter((l) => l.ok).map((l) => l.i));
  const log = [...(run.log as object[])];
  let failed: string | null = null;
  for (const [i, action] of spec.actions.entries()) {
    if (done.has(i)) continue;
    try {
      log.push({ i, action: action.type, ok: true, message: await runAction(ctx, action, i), at: new Date().toISOString() });
    } catch (err) {
      failed = err instanceof Error ? err.message : "שגיאה";
      log.push({ i, action: action.type, ok: false, message: failed, at: new Date().toISOString() });
      break;
    }
  }
  const attempts = run.attempts + 1;
  const patch = !failed
    ? { status: "done", finished_at: new Date().toISOString(), last_error: null }
    : attempts >= MAX_ATTEMPTS
      ? { status: "failed", finished_at: new Date().toISOString(), last_error: failed }
      : { status: "queued", run_at: new Date(Date.now() + attempts * 5 * 60_000).toISOString(), last_error: failed };
  await db.from("automation_runs").update({ ...patch, attempts, log }).eq("id", run.id);
  await db.from("automations").update({ last_run_at: new Date().toISOString() }).eq("id", run.automation_id);
  if (failed && attempts >= MAX_ATTEMPTS) {
    await notify({ clientId: null, kind: "automation_failed", title: `אוטומציה נכשלה אצל ${ctx.client.name}`, body: failed, link: `/admin/automations` });
  }
}

/** One tick: queue scheduled automations, then run what is due (up to 50 runs). */
export async function runAutomations(): Promise<{ ran: number }> {
  const db = createAdminClient();
  await enqueueScheduled(db).catch((e) => console.error("automations schedule", e));
  const { data } = await db
    .from("automation_runs")
    .select("id, automation_id, client_id, event, attempts, log")
    .eq("status", "queued")
    .lte("run_at", new Date().toISOString())
    .order("run_at")
    .limit(50);
  let ran = 0;
  for (const run of data ?? []) {
    const { data: claimed } = await db.from("automation_runs").update({ status: "running" }).eq("id", run.id).eq("status", "queued").select("id").maybeSingle();
    if (!claimed) continue;
    try {
      await runOne(db, run as Parameters<typeof runOne>[1]);
      ran++;
    } catch (e) {
      console.error("automation run", run.id, e);
      await db.from("automation_runs").update({ status: "queued", run_at: new Date(Date.now() + 5 * 60_000).toISOString() }).eq("id", run.id);
    }
  }
  // Runs stuck in "running" (the server died mid-run) go back to the queue.
  await db.from("automation_runs").update({ status: "queued" }).eq("status", "running").lt("run_at", new Date(Date.now() - 15 * 60_000).toISOString());
  return { ran };
}

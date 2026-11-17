import "server-only";
import { createHash, createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/automations/engine";
import { emitNewLeads } from "@/lib/automations/leads";
import { outboundNumberFor } from "@/lib/agents/phones";
import { sendSms } from "@/lib/telephony/twilio";
import { sendMail } from "@/lib/notify/mail";
import { notify } from "@/lib/notify";
import { getSecret } from "@/lib/providers/secrets";
import { rateOk } from "@/lib/security/rate";
import { toE164 } from "@/lib/phone";
import { inWindow } from "@/lib/time";
import { windowOf } from "@/lib/calls/callback";
import { israelTime, nextInWindow, type CallWindow } from "@/lib/calls/callback-time";
import * as crm from "@/lib/crm/erikscrm";
import { NoCalendar, callFlow, parseEvents, requireFlow } from "./calendar";

type Db = ReturnType<typeof createAdminClient>;

/** What the provider sends: the model's parameters plus the system variables. */
export type ToolBody = Record<string, unknown> & { agent_id?: string; caller?: string; called?: string; conversation_id?: string };

export interface ToolCtx {
  db: Db;
  clientId: string;
  client: { name: string; slug: string; meeting_minutes: number };
  agentId: string;
  agentName: string;
  /** the person on the line (E.164), or "" (browser test) */
  phone: string;
  conversationId: string;
  body: ToolBody;
}

/** The answer the model reads. Short, plain Hebrew. */
export type ToolAnswer = { result: string };
const say = (result: string): ToolAnswer => ({ result });

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const whenText = (d: Date) =>
  d.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
/** "YYYY-MM-DD HH:MM" in Israel time, the format the model sends back. */
const slotText = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
};

/** "YYYY-MM-DD HH:MM" (or with T) in Israel time → Date. */
export function parseIsraelTime(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(v.trim());
  if (!m) return null;
  const d = israelTime(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whether a meeting [start, start+minutes) fits inside the business's hours. */
export function fitsWindow(start: Date, minutes: number, w: CallWindow): boolean {
  return inWindow(w, start) && inWindow(w, new Date(start.getTime() + (minutes - 1) * 60_000));
}

/**
 * Free meeting slots: on the business's days and hours, every half hour (or the meeting
 * length if shorter), at least an hour from now, not overlapping a booked meeting.
 */
export function freeSlots(o: {
  from: Date;
  days: number;
  minutes: number;
  window: CallWindow;
  busy: { start: number; end: number }[];
  limit: number;
  now?: Date;
}): Date[] {
  const step = Math.min(30, o.minutes) * 60_000;
  const earliest = (o.now ?? new Date()).getTime() + 60 * 60_000;
  const out: Date[] = [];
  let t = Math.ceil(Math.max(o.from.getTime(), earliest) / step) * step;
  const end = o.from.getTime() + o.days * 86400_000;
  for (; t < end && out.length < o.limit; t += step) {
    const s = new Date(t);
    if (!fitsWindow(s, o.minutes, o.window)) continue;
    const e = t + o.minutes * 60_000;
    if (o.busy.some((b) => b.start < e && b.end > t)) continue;
    out.push(s);
  }
  return out;
}

/** Busy times in the business's calendar (Activepieces → Google Calendar). */
async function busyOf(ctx: ToolCtx, from: Date, to: Date) {
  const url = await requireFlow(ctx.db, ctx.clientId);
  const events = parseEvents(await callFlow(url, ctx.client.slug, "calendar_events", { from: from.toISOString(), to: to.toISOString(), timezone: "Asia/Jerusalem" }));
  return events.map((e) => ({ start: e.start, end: e.end }));
}

const NO_CALENDAR = "לעסק לא מחובר יומן, אז אי אפשר לקבוע פגישה בשיחה. מציעים שהצוות יחזור ללקוח (notify_team).";
const CALENDAR_DOWN = "היומן של העסק לא זמין כרגע. מציעים שהצוות יחזור ללקוח לקביעת מועד (notify_team).";
const calendarError = (e: unknown) => say(e instanceof NoCalendar ? NO_CALENDAR : CALENDAR_DOWN);

async function leadOf(ctx: ToolCtx) {
  if (!ctx.phone) return null;
  const { data } = await ctx.db.from("leads").select("id, name, email, notes, tags, status").eq("client_id", ctx.clientId).eq("phone", ctx.phone).maybeSingle();
  return data as { id: string; name: string; email: string; notes: string; tags: string[]; status: string } | null;
}

const once = (ctx: ToolCtx, what: string, max: number) => rateOk(`tool:${what}:${ctx.conversationId || ctx.phone || ctx.agentId}`, max, 3 * 3600);

async function checkAvailability(ctx: ToolCtx): Promise<ToolAnswer> {
  const w = await windowOf(ctx.db, ctx.clientId);
  const date = str(ctx.body.date, 10);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseIsraelTime(`${date} 00:00`) : null;
  const now = new Date();
  // One look at the calendar: the asked day, or the next 14 days.
  const from = day && day.getTime() > now.getTime() - 86400_000 ? day : now;
  const span = day ? 1 : 14;
  let busy;
  try {
    busy = await busyOf(ctx, from, new Date(from.getTime() + (span + 1) * 86400_000));
  } catch (e) {
    return calendarError(e);
  }
  let slots = freeSlots({ from, days: span, minutes: ctx.client.meeting_minutes, window: w, busy, limit: 8 });
  let note = "";
  if (!slots.length && day) {
    try {
      busy = await busyOf(ctx, now, new Date(now.getTime() + 15 * 86400_000));
    } catch (e) {
      return calendarError(e);
    }
    slots = freeSlots({ from: now, days: 14, minutes: ctx.client.meeting_minutes, window: w, busy, limit: 6 });
    note = "אין מקום בתאריך שביקשו. ";
  }
  if (!slots.length) return say("אין מועדים פנויים בשבועיים הקרובים. מציעים שהצוות יחזור ללקוח.");
  return say(
    `${note}עכשיו ${whenText(now)}. מועדים פנויים (פגישה של ${ctx.client.meeting_minutes} דקות): ` +
      slots.map((s) => `${whenText(s)} [${slotText(s)}]`).join("; ") +
      ". כדי לקבוע: book_meeting עם start בפורמט שבסוגריים.",
  );
}

async function bookMeeting(ctx: ToolCtx): Promise<ToolAnswer> {
  const start = parseIsraelTime(str(ctx.body.start, 20));
  if (!start) return say("המועד לא הובן. שולחים start בפורמט YYYY-MM-DD HH:MM.");
  if (start.getTime() < Date.now() + 30 * 60_000) return say("המועד כבר עבר או קרוב מדי. בודקים מועדים פנויים עם check_availability.");
  const w = await windowOf(ctx.db, ctx.clientId);
  if (!fitsWindow(start, ctx.client.meeting_minutes, w)) return say("המועד מחוץ לשעות הפעילות של העסק. בודקים מועדים פנויים עם check_availability.");
  const end = new Date(start.getTime() + ctx.client.meeting_minutes * 60_000);
  const lead = await leadOf(ctx);
  const name = str(ctx.body.name, 120) || lead?.name || "";
  const given = str(ctx.body.email, 200);
  const email = EMAIL.test(given) ? given : (lead?.email ?? "");
  const note = str(ctx.body.note, 1000);
  const details = str(ctx.body.details, 3000);
  const other = toE164(str(ctx.body.phone, 30)) ?? "";
  const backPhone = other && other !== ctx.phone ? other : "";
  let id = "";
  try {
    // Taken in the meantime?
    const busy = await busyOf(ctx, new Date(start.getTime() - 8 * 3600_000), end);
    if (busy.some((b) => b.start < end.getTime() && b.end > start.getTime())) {
      return say("המועד הזה כבר תפוס ביומן. בודקים מועדים פנויים אחרים עם check_availability.");
    }
    const url = await requireFlow(ctx.db, ctx.clientId);
    const created = await callFlow(url, ctx.client.slug, "calendar_create", {
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: "Asia/Jerusalem",
      title: `פגישה: ${name || ctx.phone || "לקוח"}`.slice(0, 200),
      // The phone in the description lets the agent find the caller's meetings later.
      description: [note, details, name && `שם: ${name}`, ctx.phone && `טלפון: ${ctx.phone}`, backPhone && `טלפון לחזרה: ${backPhone}`, email && `מייל: ${email}`, `נקבע על ידי ${ctx.agentName}`]
        .filter(Boolean)
        .join("\n"),
      name,
      phone: ctx.phone,
      email,
    });
    id = String((created as { id?: unknown } | null)?.id ?? "");
  } catch (e) {
    return calendarError(e);
  }

  const at = whenText(start);
  await emit({
    type: "meeting_booked",
    clientId: ctx.clientId,
    key: `meeting:${id || `${ctx.conversationId}:${start.toISOString()}`}`,
    contact: { name, phone: ctx.phone, email, leadId: lead?.id },
    lead: lead ? { id: lead.id, tags: lead.tags ?? [] } : undefined,
    data: { meeting_at: at, meeting_start: slotText(start), meeting_note: note, meeting_details: details, meeting_minutes: ctx.client.meeting_minutes, meeting_phone: backPhone || ctx.phone },
  });

  // What the caller told us stays on their lead card.
  if (lead && ((!lead.name && name) || (!lead.email && email))) {
    await ctx.db.from("leads").update({ ...(lead.name ? {} : { name }), ...(lead.email ? {} : { email }) }).eq("id", lead.id);
  }
  const lines = [`מועד: ${at} (${ctx.client.meeting_minutes} דקות)`, note && `נושא: ${note}`, details && `פרטים: ${details}`];
  const [mailed] = await Promise.all([
    email
      ? sendMail([email], `הפגישה שלך עם ${ctx.client.name} נקבעה`, [`שלום ${name || ""},`.trim(), `קבענו לך פגישה עם ${ctx.client.name}.`, ...lines.slice(0, 2)].filter(Boolean).join("\n"))
      : Promise.resolve(false),
    notify({
      clientId: ctx.clientId,
      kind: "meeting",
      title: `נקבעה פגישה: ${name || ctx.phone || "לקוח"}, ${at}`.slice(0, 200),
      body: [...lines, `טלפון: ${backPhone || ctx.phone || "לא ידוע"}`, email && `מייל: ${email}`, `נקבע על ידי ${ctx.agentName}`].filter(Boolean).join("\n"),
      link: `/${ctx.client.slug}/calls`,
      email: true,
    }),
  ]);
  return say(`הפגישה נקבעה ל${at}.${mailed ? " אישור נשלח ללקוח במייל." : ""}`);
}

/** The caller's upcoming meetings in the business's calendar (by the phone in the event). */
async function upcoming(ctx: ToolCtx) {
  const url = await requireFlow(ctx.db, ctx.clientId);
  const now = new Date();
  const raw = await callFlow(url, ctx.client.slug, "calendar_events", {
    from: now.toISOString(),
    to: new Date(now.getTime() + 60 * 86400_000).toISOString(),
    timezone: "Asia/Jerusalem",
    phone: ctx.phone,
  });
  const local = ctx.phone.replace(/^\+972/, "0");
  return parseEvents(raw)
    .filter((e) => e.start > now.getTime() && (e.description.includes(ctx.phone) || e.description.includes(local) || e.title.includes(local)))
    .sort((a, b) => a.start - b.start)
    .slice(0, 5);
}

async function myMeetings(ctx: ToolCtx): Promise<ToolAnswer> {
  if (!ctx.phone) return say("המספר של המתקשר לא ידוע, אז אין אפשרות לבדוק.");
  try {
    const list = await upcoming(ctx);
    if (!list.length) return say("למתקשר אין פגישות קרובות ביומן.");
    return say(`פגישות קרובות: ${list.map((e) => whenText(new Date(e.start))).join("; ")}.`);
  } catch (e) {
    return calendarError(e);
  }
}

async function cancelMeeting(ctx: ToolCtx): Promise<ToolAnswer> {
  if (!ctx.phone) return say("המספר של המתקשר לא ידוע.");
  try {
    const [next] = await upcoming(ctx);
    if (!next) return say("לא נמצאה פגישה קרובה למספר הזה ביומן.");
    if (!next.id) return say("הפגישה נמצאה אבל אי אפשר לבטל אותה מכאן. מעבירים לצוות (notify_team).");
    await callFlow(await requireFlow(ctx.db, ctx.clientId), ctx.client.slug, "calendar_delete", { event_id: next.id });
    const at = whenText(new Date(next.start));
    const lead = await leadOf(ctx);
    await emit({
      type: "meeting_cancelled",
      clientId: ctx.clientId,
      key: `meeting:${next.id}:cancelled`,
      contact: { name: lead?.name ?? "", phone: ctx.phone, email: lead?.email ?? "", leadId: lead?.id },
      data: { meeting_at: at },
    });
    const who = lead?.name || ctx.phone;
    await Promise.all([
      lead?.email ? sendMail([lead.email], `הפגישה שלך עם ${ctx.client.name} בוטלה`, `הפגישה של ${at} בוטלה לבקשתך.`) : null,
      notify({ clientId: ctx.clientId, kind: "meeting", title: `פגישה בוטלה: ${who}, ${at}`.slice(0, 200), body: `בוטלה בשיחה עם ${ctx.agentName}.`, link: `/${ctx.client.slug}/calls`, email: true }),
    ]);
    return say(`הפגישה של ${at} בוטלה.`);
  } catch (e) {
    return calendarError(e);
  }
}

async function sendSmsTool(ctx: ToolCtx): Promise<ToolAnswer> {
  const text = str(ctx.body.text, 300);
  if (!text) return say("ההודעה ריקה.");
  if (!ctx.phone) return say("המספר של המתקשר לא ידוע, אי אפשר לשלוח SMS.");
  const lead = await leadOf(ctx);
  if (lead?.status === "dnc") return say("המספר ברשימת לא להתקשר. לא נשלח.");
  if (!(await once(ctx, "sms", 2))) return say("כבר נשלחו שתי הודעות בשיחה הזו. לא נשלח.");
  const from = await outboundNumberFor(ctx.agentId);
  if (!from) return say("לעסק אין מספר שממנו אפשר לשלוח SMS.");
  await sendSms(from.e164, ctx.phone, text);
  return say("ההודעה נשלחה.");
}

async function saveLead(ctx: ToolCtx): Promise<ToolAnswer> {
  if (!ctx.phone) return say("המספר של המתקשר לא ידוע, הפרטים לא נשמרו.");
  const name = str(ctx.body.name, 120);
  const email = str(ctx.body.email, 200);
  const notes = str(ctx.body.notes, 1000);
  const lead = await leadOf(ctx);
  if (lead) {
    const patch: Record<string, unknown> = {};
    if (name) patch.name = name;
    if (EMAIL.test(email)) patch.email = email;
    if (notes) patch.notes = [lead.notes, notes].filter(Boolean).join("\n").slice(-2000);
    if (Object.keys(patch).length) await ctx.db.from("leads").update(patch).eq("id", lead.id);
  } else {
    const { data, error } = await ctx.db
      .from("leads")
      .insert({ client_id: ctx.clientId, name, phone: ctx.phone, email: EMAIL.test(email) ? email : "", notes, source: "call" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await emitNewLeads([data.id as string]);
  }
  if (await crm.crmConnected(ctx.clientId)) {
    await crm.ensureLead(ctx.clientId, ctx.phone, name, `ev-lead-${ctx.clientId}-${ctx.phone}`).catch((e) => console.error("call tools: CRM lead", (e as Error).message));
  }
  return say("הפרטים נשמרו.");
}

async function crmNote(ctx: ToolCtx): Promise<ToolAnswer> {
  const text = str(ctx.body.text, 2000);
  if (!text) return say("ההערה ריקה.");
  if (!ctx.phone) return say("המספר של המתקשר לא ידוע, ההערה לא נשמרה.");
  if (!(await crm.crmConnected(ctx.clientId))) return say("לעסק אין CRM מחובר. אפשר להשתמש ב־notify_team.");
  const key = createHash("sha256").update(`${ctx.conversationId}:${text}`).digest("hex").slice(0, 24);
  const card = await crm.ensureLead(ctx.clientId, ctx.phone, "", `ev-note-${key}-lead`);
  await crm.addNote(ctx.clientId, card.id, `${text}\n(${ctx.agentName}, בשיחה)`, `ev-note-${key}`);
  return say("ההערה נוספה לכרטיס ב־CRM.");
}

async function scheduleCallback(ctx: ToolCtx): Promise<ToolAnswer> {
  if (!ctx.phone) return say("המספר של המתקשר לא ידוע, אי אפשר לקבוע חזרה.");
  const lead = await leadOf(ctx);
  if (lead?.status === "dnc") return say("המספר ברשימת לא להתקשר.");
  const minutes = Number(ctx.body.in_minutes);
  let due = Number.isFinite(minutes) && minutes > 0 ? new Date(Date.now() + Math.min(minutes, 60 * 1440) * 60_000) : parseIsraelTime(str(ctx.body.at, 20));
  if (!due) return say("לא הובן מתי לחזור. שולחים at בפורמט YYYY-MM-DD HH:MM או in_minutes.");
  if (due.getTime() < Date.now() + 2 * 60_000) due = new Date(Date.now() + 2 * 60_000);
  due = nextInWindow(due, await windowOf(ctx.db, ctx.clientId));
  const request = str(ctx.body.reason, 500);
  const key = ctx.conversationId || `tool-${ctx.phone}-${Date.now()}`;
  const row = { client_id: ctx.clientId, agent_id: ctx.agentId, phone: ctx.phone, name: lead?.name ?? "", request, source_conversation_id: key, due_at: due.toISOString() };
  const { data: existing } = await ctx.db.from("callbacks").select("id").eq("source_conversation_id", key).maybeSingle();
  if (existing) await ctx.db.from("callbacks").update({ due_at: row.due_at, request, status: "scheduled" }).eq("id", existing.id);
  else {
    const { error } = await ctx.db.from("callbacks").insert(row);
    if (error) throw new Error(error.message);
  }
  await emit({
    type: "callback_requested",
    clientId: ctx.clientId,
    key: `callback:${key}`,
    contact: { name: lead?.name ?? "", phone: ctx.phone, email: lead?.email ?? "", leadId: lead?.id },
    lead: lead ? { id: lead.id, tags: lead.tags ?? [] } : undefined,
    data: { callback_at: whenText(due), callback_request: request },
  });
  return say(`נקבע: הסוכן יחזור ללקוח ב${whenText(due)}.`);
}

async function doNotCall(ctx: ToolCtx): Promise<ToolAnswer> {
  if (!ctx.phone) return say("המספר של המתקשר לא ידוע.");
  const lead = await leadOf(ctx);
  if (lead) await ctx.db.from("leads").update({ status: "dnc", next_attempt_at: null }).eq("id", lead.id);
  else await ctx.db.from("leads").insert({ client_id: ctx.clientId, phone: ctx.phone, status: "dnc", source: "call" });
  await ctx.db.from("callbacks").update({ status: "cancelled", last_result: "ביקש שלא יתקשרו אליו" }).eq("client_id", ctx.clientId).eq("phone", ctx.phone).eq("status", "scheduled");
  return say("המספר נוסף לרשימת לא להתקשר. לא יתקשרו אליו יותר.");
}

async function notifyTeam(ctx: ToolCtx): Promise<ToolAnswer> {
  const message = str(ctx.body.message, 1000);
  if (!message) return say("ההודעה ריקה.");
  if (!(await once(ctx, "notify", 3))) return say("הצוות כבר קיבל הודעות מהשיחה הזו.");
  const urgent = ctx.body.urgent === true || ctx.body.urgent === "true";
  const lead = await leadOf(ctx);
  const who = [lead?.name, ctx.phone].filter(Boolean).join(" ") || "מתקשר";
  await notify({
    clientId: ctx.clientId,
    kind: "agent",
    title: `${urgent ? "דחוף: " : ""}${ctx.agentName} מבקש: ${who}`.slice(0, 200),
    body: message,
    link: `/${ctx.client.slug}/calls`,
    email: true,
  });
  return say("הצוות קיבל את ההודעה.");
}

async function emailCaller(ctx: ToolCtx): Promise<ToolAnswer> {
  const email = str(ctx.body.email, 200);
  if (!EMAIL.test(email)) return say("כתובת המייל לא תקינה. מבקשים מהלקוח לאיית אותה שוב.");
  const subject = str(ctx.body.subject, 150) || ctx.client.name;
  const text = str(ctx.body.text, 5000);
  if (!text) return say("תוכן המייל ריק.");
  if (!(await once(ctx, "email", 2))) return say("כבר נשלחו שני מיילים בשיחה הזו. לא נשלח.");
  const ok = await sendMail([email], subject, `${text}\n\n${ctx.client.name}`);
  if (!ok) return say("שליחת המייל נכשלה.");
  const lead = await leadOf(ctx);
  if (lead && !lead.email) await ctx.db.from("leads").update({ email }).eq("id", lead.id);
  return say("המייל נשלח.");
}

async function businessAction(ctx: ToolCtx): Promise<ToolAnswer> {
  const action = str(ctx.body.action, 100);
  const details = str(ctx.body.details, 2000);
  if (!action) return say("לא נמסר שם פעולה.");
  if (!(await once(ctx, `action:${action}`, 5))) return say("הפעולה כבר בוצעה כמה פעמים בשיחה הזו.");
  const lead = await leadOf(ctx);
  await emit({
    type: "agent_action",
    clientId: ctx.clientId,
    key: `action:${ctx.conversationId}:${action}:${createHash("sha256").update(details).digest("hex").slice(0, 12)}`,
    name: action,
    data: { action, details },
    contact: { name: lead?.name ?? "", phone: ctx.phone, email: lead?.email ?? "", leadId: lead?.id },
    lead: lead ? { id: lead.id, tags: lead.tags ?? [] } : undefined,
  });
  // The business's Activepieces flow, when there is one: its answer goes back to the agent.
  const { data: conn } = await ctx.db.from("connections").select("flow_url").eq("client_id", ctx.clientId).eq("kind", "activepieces").maybeSingle();
  const url = (conn as { flow_url?: string } | null)?.flow_url;
  if (!url) return say("הבקשה נרשמה ותטופל.");
  const body = JSON.stringify({ action, client: ctx.client.slug, params: { details, phone: ctx.phone, name: lead?.name ?? "", email: lead?.email ?? "" }, event: { type: "agent_action", live: true } });
  const secret = await getSecret("activepieces_signing_secret");
  const ts = Math.floor(Date.now() / 1000).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-EriksVoice-Timestamp": ts, "X-EriksVoice-Signature": createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex") } : {}),
    },
    body,
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
  if (!res?.ok) return say("הבקשה נרשמה ותטופל.");
  const text = (await res.text().catch(() => "")).trim();
  let answer = text;
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    answer = str(j.result ?? j.message ?? j.answer ?? "", 800) || "";
  } catch {
    // plain text answer
  }
  return say(answer ? answer.slice(0, 800) : "הפעולה בוצעה.");
}

export const HANDLERS: Record<string, (ctx: ToolCtx) => Promise<ToolAnswer>> = {
  check_availability: checkAvailability,
  book_meeting: bookMeeting,
  my_meetings: myMeetings,
  cancel_meeting: cancelMeeting,
  send_sms: sendSmsTool,
  save_lead: saveLead,
  crm_note: crmNote,
  schedule_callback: scheduleCallback,
  do_not_call: doNotCall,
  notify_team: notifyTeam,
  email_caller: emailCaller,
  business_action: businessAction,
};

/** The person on the line: whichever of caller / called is not one of the business's numbers. */
export function contactPhone(caller: string, called: string, own: string[]): string {
  const a = toE164(caller) ?? "";
  const b = toE164(called) ?? "";
  if (a && !own.includes(a)) return a;
  if (b && !own.includes(b)) return b;
  return "";
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { callOut } from "@/lib/agents/phones";
import { minutesThisMonth } from "@/lib/calls/ingest";
import { inWindow } from "@/lib/time";
import { emit } from "@/lib/automations/engine";
export { inWindow, israelNow } from "@/lib/time";

type Db = ReturnType<typeof createAdminClient>;

export interface DialerSettings {
  client_id: string;
  enabled: boolean;
  agent_id: string | null;
  tag: string;
  start_minute: number;
  end_minute: number;
  days: number[];
  concurrency: number;
  max_attempts: number;
  retry_minutes: number;
}

/** A call still "out" after this long without a webhook counts as unanswered. */
const STALE_MINUTES = 20;

/** After a call attempt: done when they talked, else retry later or give up. */
export async function settleLead(
  db: Db,
  lead: { id: string; attempts: number },
  talked: boolean,
  result: string,
  s: Pick<DialerSettings, "max_attempts" | "retry_minutes">,
) {
  const patch = talked
    ? { status: "done", next_attempt_at: null }
    : lead.attempts >= s.max_attempts
      ? { status: "failed", next_attempt_at: null }
      : { status: "queued", next_attempt_at: new Date(Date.now() + s.retry_minutes * 60_000).toISOString() };
  const { data: row } = await db
    .from("leads")
    .update({ ...patch, last_result: result.slice(0, 500) })
    .eq("id", lead.id)
    .eq("status", "calling")
    .select("id, client_id, name, phone, email, tags, status, attempts")
    .maybeSingle();
  if (row && (row.status === "done" || row.status === "failed")) {
    await emit({
      type: row.status === "done" ? "lead_talked" : "lead_no_answer",
      clientId: row.client_id,
      key: `lead:${row.id}:${row.status}:${row.attempts}`,
      contact: { name: row.name, phone: row.phone, email: row.email, leadId: row.id },
      lead: { id: row.id, tags: row.tags as string[] },
    });
  }
}

async function runClient(db: Db, s: DialerSettings): Promise<number> {
  // Calls that never reported back.
  const stale = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const { data: lost } = await db.from("leads").select("id, attempts").eq("client_id", s.client_id).eq("status", "calling").lt("last_called_at", stale);
  for (const l of lost ?? []) await settleLead(db, l, false, "לא התקבלה תוצאה מהשיחה", s);

  if (!s.agent_id || !inWindow(s)) return 0;

  const { data: client } = await db.from("clients").select("status, monthly_minutes").eq("id", s.client_id).single();
  if (!client || client.status === "paused") return 0;
  if (client.monthly_minutes > 0) {
    const used = (await minutesThisMonth(s.client_id)).get(s.client_id)?.minutes ?? 0;
    if (used >= client.monthly_minutes) return 0; // quota used up: no more outbound calls this month
  }

  const { count: inflight } = await db.from("leads").select("id", { count: "exact", head: true }).eq("client_id", s.client_id).eq("status", "calling");
  const slots = s.concurrency - (inflight ?? 0);
  if (slots <= 0) return 0;

  let q = db
    .from("leads")
    .select("id, name, phone, attempts")
    .eq("client_id", s.client_id)
    .eq("status", "queued")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`)
    .order("next_attempt_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(slots);
  if (s.tag) q = q.contains("tags", [s.tag]);
  const { data: next } = await q;

  let placed = 0;
  for (const lead of next ?? []) {
    // Claim it, so a parallel run can't call the same lead.
    const { data: claimed } = await db
      .from("leads")
      .update({ status: "calling", attempts: lead.attempts + 1, last_called_at: new Date().toISOString(), last_conversation_id: null })
      .eq("id", lead.id)
      .eq("status", "queued")
      .select("id, attempts")
      .maybeSingle();
    if (!claimed) continue;
    const r = await callOut(s.agent_id, lead.phone, { name: lead.name, lead_name: lead.name });
    if (r.ok) {
      placed++;
      if (r.conversationId) await db.from("leads").update({ last_conversation_id: r.conversationId }).eq("id", lead.id);
    } else {
      await settleLead(db, claimed, false, r.error, s);
      if (/מפעילים את הסוכן|אין מספר|לא מחובר/.test(r.error)) break; // setup problem: stop this round
    }
  }
  return placed;
}

/** One tick of the cannon for every client whose dialer is on. */
export async function runDialer(): Promise<{ clients: number; placed: number }> {
  const db = createAdminClient();
  const { data } = await db.from("dialer_settings").select("*").eq("enabled", true);
  let placed = 0;
  for (const s of (data ?? []) as DialerSettings[]) {
    placed += await runClient(db, s).catch((e) => {
      console.error("dialer", s.client_id, e);
      return 0;
    });
  }
  return { clients: (data ?? []).length, placed };
}

/** Called by the post-call webhook: closes the lead behind an outbound call. */
export async function settleFromCall(conversationId: string, durationSecs: number, userSpoke: boolean, summary: string) {
  const db = createAdminClient();
  const { data: lead } = await db
    .from("leads")
    .select("id, attempts, client_id")
    .eq("last_conversation_id", conversationId)
    .eq("status", "calling")
    .maybeSingle();
  if (!lead) return;
  const { data: s } = await db.from("dialer_settings").select("max_attempts, retry_minutes").eq("client_id", lead.client_id).maybeSingle();
  const talked = userSpoke && durationSecs >= 5;
  await settleLead(db, lead, talked, talked ? summary || "שוחחו" : "לא נענתה", s ?? { max_attempts: 3, retry_minutes: 120 });
}

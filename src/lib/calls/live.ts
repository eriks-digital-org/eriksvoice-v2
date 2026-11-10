import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTwilioCall, hangupTwilioCall, isTwilioConfigured, twilioCallError } from "@/lib/telephony/twilio";

export const LIVE = ["calling", "ringing", "in_progress"] as const;

const ENDED: Record<string, { status: string; reason: string }> = {
  busy: { status: "failed", reason: "הקו היה תפוס" },
  "no-answer": { status: "no_answer", reason: "לא ענו" },
  canceled: { status: "failed", reason: "השיחה בוטלה לפני שנענתה" },
  failed: { status: "failed", reason: "Twilio לא הצליח לחייג" },
};

/**
 * Updates outbound calls that are still "live" from Twilio's view: ringing, answered, or
 * ended without a conversation (no answer, busy, failed, with Twilio's reason). Called when
 * the calls screen loads, so it stays accurate without waiting for the post-call webhook.
 */
export async function refreshLiveCalls(clientId?: string): Promise<number> {
  const db = createAdminClient();
  let q = db.from("calls").select("id, call_sid, status, started_at").in("status", LIVE as unknown as string[]).limit(30);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  const rows = (data ?? []) as { id: string; call_sid: string | null; status: string; started_at: string }[];
  if (rows.length === 0) return 0;
  const twilio = await isTwilioConfigured();
  let live = 0;
  await Promise.all(
    rows.map(async (r) => {
      const age = Date.now() - new Date(r.started_at).getTime();
      if (!r.call_sid || !twilio) {
        // Nothing to ask: give up on it after an hour.
        if (age > 3_600_000) await db.from("calls").update({ status: "done", ended_at: new Date().toISOString() }).eq("id", r.id);
        else live++;
        return;
      }
      const c = await getTwilioCall(r.call_sid).catch(() => null);
      if (!c) return void live++;
      if (c.status === "queued" || c.status === "ringing" || c.status === "in-progress") {
        live++;
        const status = c.status === "in-progress" ? "in_progress" : c.status === "ringing" ? "ringing" : "calling";
        if (status !== r.status) await db.from("calls").update({ status }).eq("id", r.id);
        return;
      }
      const now = new Date().toISOString();
      if (c.status === "completed") {
        // The post-call webhook fills in the transcript and summary.
        await db.from("calls").update({ status: "done", duration_secs: c.duration, ended_at: now }).in("status", LIVE as unknown as string[]).eq("id", r.id);
        return;
      }
      const e = ENDED[c.status];
      const detail = c.status === "failed" ? await twilioCallError(r.call_sid).catch(() => "") : "";
      await db.from("calls").update({ status: e.status, end_reason: detail || e.reason, ended_at: now }).eq("id", r.id);
    }),
  );
  return live;
}

/** Hangs up a live outbound call. Pass clientId to make sure the call belongs to that client. */
export async function hangupCall(callId: string, clientId?: string): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();
  let q = db.from("calls").select("id, call_sid, status").eq("id", callId);
  if (clientId) q = q.eq("client_id", clientId);
  const { data: call } = await q.maybeSingle();
  if (!call) return { ok: false, error: "השיחה לא נמצאה" };
  if (call.call_sid) {
    try {
      await hangupTwilioCall(call.call_sid);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "הניתוק נכשל" };
    }
  }
  await db.from("calls").update({ status: "done", end_reason: "נותקה ידנית", ended_at: new Date().toISOString() }).eq("id", callId);
  return { ok: true };
}

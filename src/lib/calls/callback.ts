import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { callOut } from "@/lib/agents/phones";
import { minutesThisMonth } from "@/lib/calls/ingest";
import { emit } from "@/lib/automations/engine";
import { inWindow } from "@/lib/time";
import { DEFAULT_WINDOW, callbackTime, nextInWindow, type CallWindow } from "./callback-time";

type Db = ReturnType<typeof createAdminClient>;

const MAX_ATTEMPTS = 3;
const RETRY_MINUTES = 30;
/** A call-back still "out" after this long without a webhook counts as unanswered. */
const STALE_MINUTES = 20;

/** The client's calling hours: the dialer's when set, otherwise Sunday–Thursday 09:00–19:00. */
async function windowOf(db: Db, clientId: string): Promise<CallWindow> {
  const { data } = await db.from("dialer_settings").select("days, start_minute, end_minute").eq("client_id", clientId).maybeSingle();
  return data ? { days: data.days as number[], start_minute: data.start_minute as number, end_minute: data.end_minute as number } : DEFAULT_WINDOW;
}

const when = (d: Date) =>
  d.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * After a call ended (from ingest). In order:
 *  1. closes the call-back this call was (talked → done, else retry or give up);
 *  2. cancels call-backs to this number asked before this call, when they talked now;
 *  3. schedules a new one when the caller asked for it in this call.
 */
export async function afterCall(o: {
  clientId: string;
  agentId: string;
  conversationId: string;
  phone: string;
  startedAt: Date;
  endedAt: Date;
  talked: boolean;
  summary: string;
  collected: Record<string, unknown>;
}) {
  const db = createAdminClient();
  const { data: own } = await db
    .from("callbacks")
    .select("id, client_id, attempts")
    .eq("last_conversation_id", o.conversationId)
    .eq("status", "calling")
    .maybeSingle();
  if (own) await settle(db, own, o.talked, o.talked ? o.summary || "שוחחו" : "לא נענתה");

  if (!o.phone) return;
  if (o.talked) {
    await db
      .from("callbacks")
      .update({ status: "cancelled", last_result: "הלקוח שוחח עם העסק לפני המועד" })
      .eq("client_id", o.clientId)
      .eq("phone", o.phone)
      .eq("status", "scheduled")
      .lt("created_at", o.startedAt.toISOString());
  }

  const due = callbackTime(o.collected, o.endedAt, await windowOf(db, o.clientId));
  if (!due) return;
  const { data: lead } = await db.from("leads").select("id, name, email, tags, status").eq("client_id", o.clientId).eq("phone", o.phone).maybeSingle();
  if (lead?.status === "dnc") return;
  const request = String(o.collected.callback_note ?? "").trim().slice(0, 500);
  const { data: created } = await db
    .from("callbacks")
    .upsert(
      {
        client_id: o.clientId,
        agent_id: o.agentId,
        phone: o.phone,
        name: (lead?.name as string | undefined) ?? "",
        request,
        source_conversation_id: o.conversationId,
        due_at: due.toISOString(),
      },
      { onConflict: "source_conversation_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (!created) return; // already scheduled from this call
  await emit({
    type: "callback_requested",
    clientId: o.clientId,
    key: `callback:${o.conversationId}`,
    contact: { name: (lead?.name as string | undefined) ?? "", phone: o.phone, email: (lead?.email as string | undefined) ?? "", leadId: lead?.id as string | undefined },
    lead: lead ? { id: lead.id as string, tags: (lead.tags as string[]) ?? [] } : undefined,
    data: { callback_at: when(due), callback_request: request },
  });
}

async function settle(db: Db, cb: { id: string; client_id: string; attempts: number }, talked: boolean, result: string) {
  const patch = talked
    ? { status: "done" }
    : cb.attempts >= MAX_ATTEMPTS
      ? { status: "failed" }
      : { status: "scheduled", due_at: nextInWindow(new Date(Date.now() + RETRY_MINUTES * 60_000), await windowOf(db, cb.client_id)).toISOString() };
  await db
    .from("callbacks")
    .update({ ...patch, last_result: result.slice(0, 500) })
    .eq("id", cb.id)
    .eq("status", "calling");
}

/** One tick (every minute, with the dialer): places the call-backs that are due. */
export async function runCallbacks(): Promise<{ placed: number }> {
  const db = createAdminClient();
  const stale = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const { data: lost } = await db.from("callbacks").select("id, client_id, attempts").eq("status", "calling").lt("last_called_at", stale);
  for (const cb of lost ?? []) await settle(db, cb, false, "לא התקבלה תוצאה מהשיחה");

  const { data: due } = await db
    .from("callbacks")
    .select("id, client_id, agent_id, phone, name, request, attempts")
    .eq("status", "scheduled")
    .lte("due_at", new Date().toISOString())
    .order("due_at")
    .limit(20);
  let placed = 0;
  const quota = new Map<string, boolean>();
  for (const cb of due ?? []) {
    try {
      const w = await windowOf(db, cb.client_id);
      if (!inWindow(w)) {
        // The calling hours changed since it was scheduled.
        await db.from("callbacks").update({ due_at: nextInWindow(new Date(), w).toISOString() }).eq("id", cb.id).eq("status", "scheduled");
        continue;
      }
      const { data: lead } = await db.from("leads").select("status").eq("client_id", cb.client_id).eq("phone", cb.phone).maybeSingle();
      if (lead?.status === "dnc") {
        await db.from("callbacks").update({ status: "cancelled", last_result: "המספר ברשימת לא להתקשר" }).eq("id", cb.id);
        continue;
      }
      if (!quota.has(cb.client_id)) {
        const { data: client } = await db.from("clients").select("monthly_minutes").eq("id", cb.client_id).single();
        const limit = (client?.monthly_minutes as number | undefined) ?? 0;
        const used = limit > 0 ? ((await minutesThisMonth(cb.client_id)).get(cb.client_id)?.minutes ?? 0) : 0;
        quota.set(cb.client_id, limit === 0 || used < limit);
      }
      if (!quota.get(cb.client_id)) continue; // stays scheduled until there are minutes again

      const { data: claimed } = await db
        .from("callbacks")
        .update({ status: "calling", attempts: cb.attempts + 1, last_called_at: new Date().toISOString(), last_conversation_id: null })
        .eq("id", cb.id)
        .eq("status", "scheduled")
        .select("id, client_id, attempts")
        .maybeSingle();
      if (!claimed) continue;
      const r = await callOut(cb.agent_id, cb.phone, {
        name: cb.name,
        lead_name: cb.name,
        call_reason: "חזרה ללקוח שביקש שנחזור אליו",
        callback_request: cb.request,
      });
      if (r.ok) {
        placed++;
        if (r.conversationId) await db.from("callbacks").update({ last_conversation_id: r.conversationId }).eq("id", cb.id);
      } else {
        await settle(db, claimed, false, r.error);
      }
    } catch (e) {
      console.error("callbacks", cb.id, e);
    }
  }
  return { placed };
}

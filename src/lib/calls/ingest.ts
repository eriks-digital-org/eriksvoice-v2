import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import * as voice from "@/lib/voice/elevenlabs";

/**
 * Verifies the provider's webhook signature: header "t=<unix>,v0=<hex>", where
 * v0 = HMAC-SHA256(secret, "<t>.<raw body>"). Rejects anything older than 30 minutes.
 */
export function verifySignature(header: string | null, raw: string, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!parts.v0 || !Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 30 * 60) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v0);
  return a.length === b.length && timingSafeEqual(a, b);
}

const OUTCOMES = new Set(["success", "failure", "unknown"]);

/** Stores (or updates) one provider conversation. Returns false when it isn't one of our agents. */
export async function ingestConversation(c: voice.ProviderConversation): Promise<boolean> {
  const db = createAdminClient();
  const { data: agent } = await db.from("agents").select("id, client_id").eq("provider_agent_id", c.agent_id).maybeSingle();
  if (!agent) return false;

  const phone = c.metadata?.phone_call ?? null;
  const direction = phone ? (phone.direction === "outbound" ? "outbound" : "inbound") : "web";
  const start = c.metadata?.start_time_unix_secs;
  const collected = Object.fromEntries(
    Object.entries(c.analysis?.data_collection_results ?? {}).map(([k, v]) => [k, v?.value ?? null]),
  );
  const outcome = c.analysis?.call_successful ?? "unknown";

  const { error } = await db.from("calls").upsert(
    {
      client_id: agent.client_id,
      agent_id: agent.id,
      provider_conversation_id: c.conversation_id,
      direction,
      external_number: phone?.external_number ?? "",
      agent_number: phone?.agent_number ?? "",
      status: c.status ?? "done",
      outcome: OUTCOMES.has(outcome) ? outcome : "unknown",
      started_at: start ? new Date(start * 1000).toISOString() : new Date().toISOString(),
      duration_secs: Math.max(0, Math.round(c.metadata?.call_duration_secs ?? 0)),
      summary: c.analysis?.transcript_summary ?? "",
      transcript: (c.transcript ?? [])
        .filter((t) => t.message)
        .map((t) => ({ role: t.role === "agent" ? "agent" : "user", text: t.message, at: t.time_in_call_secs ?? 0 })),
      collected,
      has_audio: c.has_audio ?? true,
    },
    { onConflict: "provider_conversation_id" },
  );
  if (error) throw new Error(error.message);
  await checkQuota(agent.client_id);
  return true;
}

/** Month start in Israel time, as yyyy-mm-01. */
export function monthKey(d = new Date()): string {
  const s = d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  return `${s.slice(0, 7)}-01`;
}

/** Minutes used this month (Israel time) by one client, or by all clients. */
export async function minutesThisMonth(clientId?: string): Promise<Map<string, { minutes: number; calls: number }>> {
  const db = createAdminClient();
  let q = db.from("client_month_usage").select("client_id, minutes, calls").eq("month", `${monthKey()}T00:00:00`);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  return new Map((data ?? []).map((r) => [r.client_id as string, { minutes: r.minutes as number, calls: r.calls as number }]));
}

/** At 80% of the monthly quota: one notification to the client and one to the admin, once a month. */
async function checkQuota(clientId: string) {
  const db = createAdminClient();
  const { data: client } = await db.from("clients").select("name, slug, monthly_minutes, quota_alerted_month").eq("id", clientId).single();
  if (!client || !client.monthly_minutes) return;
  const month = monthKey();
  if (client.quota_alerted_month === month) return;
  const used = (await minutesThisMonth(clientId)).get(clientId)?.minutes ?? 0;
  if (used < client.monthly_minutes * 0.8) return;
  const pct = Math.round((used / client.monthly_minutes) * 100);
  await db.from("clients").update({ quota_alerted_month: month }).eq("id", clientId);
  await db.from("notifications").insert([
    {
      client_id: clientId,
      kind: "quota",
      title: `נוצלו ${pct}% מדקות החודש`,
      body: `${used} מתוך ${client.monthly_minutes} דקות.`,
      link: `/${client.slug}/usage`,
    },
    {
      client_id: null,
      kind: "quota",
      title: `${client.name}: ${pct}% מדקות החודש`,
      body: `${used} מתוך ${client.monthly_minutes} דקות.`,
      link: `/admin/clients/${clientId}`,
    },
  ]);
}

/** Pulls recent conversations of a client's agents (for calls the webhook missed). */
export async function backfillClient(clientId: string, perAgent = 50): Promise<number> {
  const db = createAdminClient();
  const { data: agents } = await db.from("agents").select("provider_agent_id").eq("client_id", clientId).not("provider_agent_id", "is", null);
  let added = 0;
  for (const a of agents ?? []) {
    const ids = await voice.listConversationIds(a.provider_agent_id as string, perAgent);
    if (!ids.length) continue;
    const { data: known } = await db.from("calls").select("provider_conversation_id").in("provider_conversation_id", ids);
    const have = new Set((known ?? []).map((k) => k.provider_conversation_id));
    for (const id of ids.filter((i) => !have.has(i))) {
      const c = await voice.getConversation(id);
      if (c.status && !["done", "failed"].includes(c.status)) continue; // still running
      if (await ingestConversation(c)) added++;
    }
  }
  return added;
}

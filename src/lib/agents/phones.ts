import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import * as voice from "@/lib/voice/elevenlabs";
import { isTwilioConfigured, twilioCredentials } from "@/lib/telephony/twilio";

const message = (e: unknown) => (e instanceof Error ? e.message : "שגיאה לא צפויה");

/**
 * Makes the voice provider route each of the client's numbers to the agent set here.
 * A number reaches only an ACTIVE agent of the same client; otherwise nobody answers it.
 * A number is imported into the provider the first time it has an active agent.
 */
export async function routeClientNumbers(clientId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await voice.isVoiceConfigured()) || !(await isTwilioConfigured())) return { ok: true };
  const db = createAdminClient();
  const [{ data: numbers }, { data: agents }, { data: client }] = await Promise.all([
    db.from("phone_numbers").select("id, e164, agent_id, provider_phone_id").eq("client_id", clientId),
    db.from("agents").select("id, name, status, provider_agent_id").eq("client_id", clientId),
    db.from("clients").select("name").eq("id", clientId).single(),
  ]);
  let firstError: string | undefined;
  for (const n of numbers ?? []) {
    const agent = (agents ?? []).find((a) => a.id === n.agent_id);
    const target = agent && agent.status === "active" && agent.provider_agent_id ? (agent.provider_agent_id as string) : null;
    try {
      let phoneId = n.provider_phone_id as string | null;
      if (!phoneId && target) {
        const { sid, token } = await twilioCredentials();
        phoneId = await voice.importTwilioNumber({ number: n.e164, label: `${client?.name ?? ""} ${n.e164}`, sid, token });
        await db.from("phone_numbers").update({ provider_phone_id: phoneId }).eq("id", n.id);
      }
      if (phoneId) await voice.routeNumber(phoneId, target);
      await db.from("phone_numbers").update({ route_error: null, routed_at: new Date().toISOString() }).eq("id", n.id);
    } catch (e) {
      firstError ??= message(e);
      await db.from("phone_numbers").update({ route_error: message(e) }).eq("id", n.id);
    }
  }
  return firstError ? { ok: false, error: firstError } : { ok: true };
}

/** Releases a number from the voice provider (before it is removed from a client). */
export async function releaseNumber(phoneRowId: string) {
  const db = createAdminClient();
  const { data } = await db.from("phone_numbers").select("provider_phone_id").eq("id", phoneRowId).maybeSingle();
  if (data?.provider_phone_id && (await voice.isVoiceConfigured())) await voice.deleteNumber(data.provider_phone_id);
}

/**
 * The number an agent calls out from: its own number, or else the client's primary number.
 */
export async function outboundNumberFor(agentId: string) {
  const db = createAdminClient();
  const { data: agent } = await db.from("agents").select("client_id").eq("id", agentId).single();
  if (!agent) return null;
  const { data: numbers } = await db
    .from("phone_numbers")
    .select("id, e164, agent_id, is_primary, provider_phone_id")
    .eq("client_id", agent.client_id);
  const list = numbers ?? [];
  return list.find((n) => n.agent_id === agentId) ?? list.find((n) => n.is_primary) ?? null;
}

/**
 * Places a call from an active agent to a phone, from the agent's outbound number
 * (imported to the voice service on first use). Returns the provider's conversation id.
 */
export async function callOut(
  agentId: string,
  to: string,
  variables?: Record<string, string>,
): Promise<{ ok: true; from: string; conversationId: string | null; callId: string | null } | { ok: false; error: string }> {
  const db = createAdminClient();
  const { data: agent } = await db.from("agents").select("client_id, status, provider_agent_id").eq("id", agentId).maybeSingle();
  if (!agent?.provider_agent_id || agent.status !== "active") return { ok: false, error: "קודם מפעילים את הסוכן" };
  let number = await outboundNumberFor(agentId);
  if (!number) return { ok: false, error: "ללקוח אין מספר טלפון" };
  // Every attempt is recorded, so the calls screen shows failed and live calls too.
  const record = async (row: Record<string, unknown>) => {
    const { data, error } = await db
      .from("calls")
      .insert({ client_id: agent.client_id, agent_id: agentId, direction: "outbound", external_number: to, agent_number: number?.e164 ?? "", outcome: "unknown", has_audio: false, ...row })
      .select("id")
      .single();
    if (error) console.error("calls: record outbound failed", error.message);
    return (data?.id as string | undefined) ?? null;
  };
  try {
    if (!number.provider_phone_id) {
      const { sid, token } = await twilioCredentials();
      const phoneId = await voice.importTwilioNumber({ number: number.e164, label: number.e164, sid, token });
      await db.from("phone_numbers").update({ provider_phone_id: phoneId }).eq("id", number.id);
      await voice.routeNumber(phoneId, null);
      number = { ...number, provider_phone_id: phoneId };
    }
    const r = await voice.outboundCall({ agentId: agent.provider_agent_id, phoneId: number.provider_phone_id as string, to, variables });
    const callId = await record({ provider_conversation_id: r.conversationId, call_sid: r.callSid, status: "calling", summary: "" });
    return { ok: true, from: number.e164, conversationId: r.conversationId, callId };
  } catch (e) {
    const error = e instanceof Error ? e.message : "השיחה לא יצאה";
    await record({ status: "failed", end_reason: error, ended_at: new Date().toISOString() });
    return { ok: false, error };
  }
}

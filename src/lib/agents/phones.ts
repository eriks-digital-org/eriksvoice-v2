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

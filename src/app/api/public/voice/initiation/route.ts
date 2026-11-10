import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSecret } from "@/lib/providers/secrets";
import { callerVariables } from "@/lib/calls/caller";
import { toE164 } from "@/lib/phone";

/**
 * Caller ID for inbound calls: ElevenLabs asks this address, before the agent answers, who is
 * calling (set once in ElevenLabs → Agents → Settings, "conversation initiation" webhook, with the
 * header X-EriksVoice-Key = the secret saved in Settings → Providers → ElevenLabs).
 * Always answers 200 quickly: a failed answer would stop the call from starting.
 */
export async function POST(req: Request) {
  const empty = (vars: Record<string, string> = {}) =>
    NextResponse.json({ type: "conversation_initiation_client_data", dynamic_variables: vars });
  const blank = await callerVariables("", "");
  const secret = await getSecret("elevenlabs_initiation_secret");
  const given = req.headers.get("x-eriksvoice-key") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) return empty(blank);

  let body: { caller_id?: string; agent_id?: string };
  try {
    body = await req.json();
  } catch {
    return empty(blank);
  }
  const phone = toE164(body.caller_id ?? "") ?? "";
  try {
    const { data: agent } = await createAdminClient().from("agents").select("client_id").eq("provider_agent_id", body.agent_id ?? "").maybeSingle();
    if (!agent) return empty({ ...blank, caller_phone: phone });
    return empty(await callerVariables(agent.client_id as string, phone));
  } catch (e) {
    console.error("initiation webhook", e);
    return empty({ ...blank, caller_phone: phone });
  }
}

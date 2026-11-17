import "server-only";
import { publicOrigin } from "@/lib/origin";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSecret } from "@/lib/providers/secrets";
import * as voice from "@/lib/voice/elevenlabs";
import { WEBHOOK_TOOLS, type CallToolDef } from "./definitions";

type Db = ReturnType<typeof createAdminClient>;

/** The header the provider sends with every tool call (the same secret as the caller-ID webhook). */
export const TOOLS_SECRET = "elevenlabs_initiation_secret";
export const TOOLS_HEADER = "x-eriksvoice-key";

const origin = () => publicOrigin();

/** Who and which call: filled by the provider from its system variables, never by the model. */
const SYSTEM_PROPS = {
  agent_id: { type: "string", dynamic_variable: "system__agent_id" },
  caller: { type: "string", dynamic_variable: "system__caller_id" },
  called: { type: "string", dynamic_variable: "system__called_number" },
  conversation_id: { type: "string", dynamic_variable: "system__conversation_id" },
};

export function toolConfig(def: CallToolDef, secret: string): voice.WebhookToolConfig {
  return {
    type: "webhook",
    name: def.name,
    description: def.description,
    response_timeout_secs: def.timeoutSecs ?? 10,
    api_schema: {
      url: `${origin()}/api/public/voice/tools/${def.name}`,
      method: "POST",
      request_headers: { "X-EriksVoice-Key": secret },
      request_body_schema: {
        type: "object",
        description: def.description,
        required: Object.entries(def.params)
          .filter(([, p]) => p.required)
          .map(([k]) => k),
        properties: {
          ...Object.fromEntries(Object.entries(def.params).map(([k, p]) => [k, { type: p.type, description: p.description }])),
          ...SYSTEM_PROPS,
        },
      },
    },
  };
}

/**
 * The in-call tools at the provider (one set shared by every agent), created or updated when
 * their definition changed. Returns name → provider tool id. Without the shared secret there are
 * no tools (they would be refused by our server anyway).
 */
export async function ensureCallTools(db: Db): Promise<Record<string, string>> {
  const secret = await getSecret(TOOLS_SECRET);
  if (!secret) {
    console.error("call tools: no elevenlabs_initiation_secret, tools not attached");
    return {};
  }
  const { data } = await db.from("system_settings").select("call_tools").eq("id", true).single();
  const saved = ((data?.call_tools ?? {}) as Record<string, { id: string; hash: string }>) ?? {};
  const next: Record<string, { id: string; hash: string }> = { ...saved };
  let changed = false;
  for (const def of WEBHOOK_TOOLS) {
    const config = toolConfig(def, secret);
    const hash = createHash("sha256").update(JSON.stringify(config)).digest("hex");
    const have = saved[def.name];
    if (have?.hash === hash) continue;
    try {
      if (have?.id) {
        try {
          await voice.updateTool(have.id, config);
        } catch (e) {
          // Deleted at the provider: create it again.
          if (!(e instanceof voice.VoiceProviderError && e.status === 404)) throw e;
          next[def.name] = { id: await voice.createTool(config), hash };
          changed = true;
          continue;
        }
        next[def.name] = { id: have.id, hash };
      } else {
        next[def.name] = { id: await voice.createTool(config), hash };
      }
      changed = true;
    } catch (e) {
      console.error("call tools: not sent", def.name, (e as Error).message);
    }
  }
  if (changed) await db.from("system_settings").update({ call_tools: next }).eq("id", true);
  return Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v.id]));
}

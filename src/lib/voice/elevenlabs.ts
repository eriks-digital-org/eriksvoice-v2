import "server-only";

/**
 * ElevenLabs Conversational AI, behind a small provider surface (see provider.ts).
 * Endpoints: /v1/convai/agents, /v1/convai/knowledge-base, /v2/voices, /v1/convai/llm/list.
 */
const ROOT = "https://api.elevenlabs.io";

export class VoiceProviderError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

export const isVoiceConfigured = () => Boolean(process.env.ELEVENLABS_API_KEY);

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new VoiceProviderError("שירות הקול עוד לא מחובר (ELEVENLABS_API_KEY).");
  return k;
}

/** One Hebrew sentence for a provider failure. */
function explain(status: number, body: string): string {
  const lower = body.toLowerCase();
  if (lower.includes("expressive_tts_not_allowed")) return "מודל הדיבור שנבחר לא כלול בחבילה. v4 Turbo תומך בעברית.";
  if (status === 401) return "מפתח ElevenLabs לא תקין.";
  if (status === 524 || status === 504) return "שירות הקול לא הספיק להשיב. נסו שוב.";
  if (status === 422) return `שירות הקול דחה את הבקשה: ${body.slice(0, 200)}`;
  return `שירות הקול החזיר שגיאה (${status}): ${body.slice(0, 200)}`;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(ROOT + path, {
    ...init,
    headers: { "xi-api-key": key(), "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw new VoiceProviderError("שירות הקול לא הגיב. נסו שוב.");
  const text = await res.text();
  if (!res.ok) throw new VoiceProviderError(explain(res.status, text), res.status);
  return (text ? JSON.parse(text) : {}) as T;
}

export interface Voice {
  id: string;
  name: string;
  /** e.g. "female · young · israeli" */
  description: string;
  previewUrl: string | null;
}

/** Every voice in the account's library (premade and added). */
export async function listVoices(): Promise<Voice[]> {
  const out: Voice[] = [];
  let token: string | null = null;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ page_size: "100", include_total_count: "false", sort: "name", sort_direction: "asc" });
    if (token) q.set("next_page_token", token);
    const r = await call<{
      voices: { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string | null }[];
      has_more: boolean;
      next_page_token: string | null;
    }>(`/v2/voices?${q}`);
    for (const v of r.voices) {
      const l = v.labels ?? {};
      out.push({
        id: v.voice_id,
        name: v.name,
        description: [l.gender, l.age, l.accent, l.language].filter(Boolean).join(" · "),
        previewUrl: v.preview_url ?? null,
      });
    }
    if (!r.has_more || !r.next_page_token) break;
    token = r.next_page_token;
  }
  return out;
}

/** Conversation models the account can use with agents. */
export async function listLlms(): Promise<string[]> {
  const r = await call<{ llms: { llm: string; is_checkpoint?: boolean }[] }>("/v1/convai/llm/list");
  return r.llms.filter((m) => !m.is_checkpoint).map((m) => m.llm);
}

export interface KnowledgeRef {
  id: string;
  name: string;
}

export interface AgentConfig {
  name: string;
  prompt: string;
  firstMessage: string;
  language: string;
  llm: string;
  voiceId: string;
  ttsModel: string;
  /** Eleven Realtime model, or null for the custom pipeline (LLM + speech model). */
  realtimeModel: string | null;
  voiceSettings: { stability?: number; speed?: number; similarity_boost?: number };
  turn: { turn_timeout?: number; turn_eagerness?: string; silence_end_call_timeout?: number };
  knowledge: KnowledgeRef[];
  tags: string[];
}

function body(c: AgentConfig) {
  const prompt: Record<string, unknown> = {
    prompt: c.prompt,
    knowledge_base: c.knowledge.map((k) => ({ type: "text", id: k.id, name: k.name, usage_mode: "auto" })),
    rag: { enabled: c.knowledge.length > 0, embedding_model: "multilingual_e5_large_instruct" },
  };
  // In Realtime mode the provider manages the LLM and the speech model, so we don't send them.
  // NOTE: the documented param is `realtime_model`; its place under agent.prompt follows the
  // docs' managed-settings table and is verified against the live API.
  if (c.realtimeModel) prompt.realtime_model = c.realtimeModel;
  else {
    prompt.realtime_model = null;
    if (c.llm) prompt.llm = c.llm;
  }
  const tts: Record<string, unknown> = { ...(c.realtimeModel ? {} : { model_id: c.ttsModel }), ...c.voiceSettings };
  if (c.voiceId) tts.voice_id = c.voiceId;
  return {
    name: c.name,
    tags: c.tags,
    conversation_config: {
      agent: { first_message: c.firstMessage, language: c.language, prompt },
      tts,
      ...(Object.keys(c.turn).length ? { turn: c.turn } : {}),
    },
  };
}

export async function createAgent(c: AgentConfig): Promise<string> {
  const r = await call<{ agent_id: string }>("/v1/convai/agents/create", { method: "POST", body: JSON.stringify(body(c)) });
  return r.agent_id;
}

export async function updateAgent(id: string, c: AgentConfig): Promise<void> {
  await call(`/v1/convai/agents/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body(c)) });
}

export async function deleteAgent(id: string): Promise<void> {
  try {
    await call(`/v1/convai/agents/${encodeURIComponent(id)}?force=true`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof VoiceProviderError && e.status === 404)) throw e;
  }
}

export async function createKnowledgeText(name: string, text: string): Promise<string> {
  const r = await call<{ id: string }>("/v1/convai/knowledge-base/text", {
    method: "POST",
    body: JSON.stringify({ name, text }),
  });
  return r.id;
}

export async function deleteKnowledge(id: string): Promise<void> {
  try {
    await call(`/v1/convai/knowledge-base/${encodeURIComponent(id)}?force=true`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof VoiceProviderError && e.status === 404)) throw e;
  }
}

/** Imports a Twilio number into the voice provider; returns the provider's phone id. */
export async function importTwilioNumber(n: { number: string; label: string; sid: string; token: string }): Promise<string> {
  const r = await call<{ phone_number_id: string }>("/v1/convai/phone-numbers", {
    method: "POST",
    body: JSON.stringify({ provider: "twilio", phone_number: n.number, label: n.label.slice(0, 60), sid: n.sid, token: n.token }),
  });
  return r.phone_number_id;
}

/** Which agent answers this number (null: nobody). */
export async function routeNumber(phoneId: string, agentId: string | null): Promise<void> {
  await call(`/v1/convai/phone-numbers/${encodeURIComponent(phoneId)}`, {
    method: "PATCH",
    body: JSON.stringify({ agent_id: agentId }),
  });
}

export async function deleteNumber(phoneId: string): Promise<void> {
  try {
    await call(`/v1/convai/phone-numbers/${encodeURIComponent(phoneId)}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof VoiceProviderError && e.status === 404)) throw e;
  }
}

/** An outbound call by an agent from one of its numbers. */
export async function outboundCall(o: {
  agentId: string;
  phoneId: string;
  to: string;
  variables?: Record<string, string>;
}): Promise<{ conversationId: string | null; callSid: string | null }> {
  const r = await call<{ success?: boolean; message?: string; conversation_id?: string | null; callSid?: string | null }>(
    "/v1/convai/twilio/outbound-call",
    {
      method: "POST",
      body: JSON.stringify({
        agent_id: o.agentId,
        agent_phone_number_id: o.phoneId,
        to_number: o.to,
        ...(o.variables ? { conversation_initiation_client_data: { dynamic_variables: o.variables } } : {}),
      }),
    },
  );
  if (r.success === false) throw new VoiceProviderError(`השיחה לא יצאה: ${r.message ?? ""}`.trim());
  return { conversationId: r.conversation_id ?? null, callSid: r.callSid ?? null };
}

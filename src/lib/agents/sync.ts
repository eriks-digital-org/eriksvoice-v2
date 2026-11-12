import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import * as voice from "@/lib/voice/elevenlabs";
import { buildPrompt, namedBusiness } from "./prompt";
import type { AllowedVoice } from "@/lib/voice/models";
import { routeClientNumbers } from "./phones";
import { isRealtimeModel } from "@/lib/voice/models";
import { CALLBACK_FIELDS } from "@/lib/calls/callback-time";

type Db = ReturnType<typeof createAdminClient>;

interface AgentFull {
  id: string;
  client_id: string;
  type_key: string;
  name: string;
  status: "draft" | "active" | "paused";
  voice_id: string | null;
  opening_line: string;
  llm_model_override: string | null;
  realtime_model_override: string | null;
  custom_prompt: string;
  provider_agent_id: string | null;
}

export type SyncResult = { ok: true } | { ok: false; error: string };

const message = (e: unknown) => (e instanceof Error ? e.message : "שגיאה לא צפויה");

/**
 * Mirrors the client's knowledge items to the provider's knowledge base. An item is
 * uploaded again only when its text changed; the old document is queued for deletion.
 */
async function syncKnowledge(db: Db, clientId: string) {
  const { data } = await db
    .from("knowledge_items")
    .select("id, title, body, all_agents, provider_doc_id, provider_doc_hash")
    .eq("client_id", clientId);
  const items = data ?? [];
  for (const item of items) {
    const text = `${item.title}\n\n${item.body}`.trim();
    const hash = createHash("sha256").update(text).digest("hex");
    if (item.provider_doc_id && item.provider_doc_hash === hash) continue;
    if (!item.body.trim()) continue;
    const docId = await voice.createKnowledgeText(item.title, text);
    await db.from("knowledge_items").update({ provider_doc_id: docId, provider_doc_hash: hash }).eq("id", item.id);
    item.provider_doc_id = docId;
  }
  const { data: links } = await db.from("knowledge_item_agents").select("item_id, agent_id").eq("client_id", clientId);
  return { items, links: links ?? [] };
}

async function flushTrash(db: Db) {
  const { data } = await db.from("provider_doc_trash").select("doc_id").limit(50);
  for (const { doc_id } of data ?? []) {
    try {
      await voice.deleteKnowledge(doc_id);
      await db.from("provider_doc_trash").delete().eq("doc_id", doc_id);
    } catch {
      // Stays in the trash; the next sync tries again.
    }
  }
}

/** An active agent of the same business, as a hand-over target. */
interface Peer {
  id: string;
  providerId: string | null;
  name: string;
  typeName: string;
  purpose: string;
  realtime: boolean;
  active: boolean;
}

async function pushAgent(db: Db, agent: AgentFull, knowledge: Awaited<ReturnType<typeof syncKnowledge>>, peers: Peer[]) {
  const [{ data: type }, { data: settings }, { data: client }, { data: others }, { data: automations }] = await Promise.all([
    db.from("agent_types").select("*").eq("key", agent.type_key).single(),
    db.from("system_settings").select("safety_rules").eq("id", true).single(),
    db.from("clients").select("slug, name, industry, address, contact_phone, business_hours").eq("id", agent.client_id).single(),
    db.from("clients").select("name").neq("id", agent.client_id),
    db.from("automations").select("spec").eq("client_id", agent.client_id).eq("enabled", true),
  ]);
  if (!type || !client) throw new Error("חסרים נתוני סוג או לקוח");

  const voiceId = agent.voice_id || type.default_voice_id;
  const allowed = (type.allowed_voices ?? []) as AllowedVoice[];
  // The voice's gender, so the agent speaks of itself accordingly (from the allowed list,
  // otherwise from the account's voices).
  let gender = allowed.find((v) => v.id === voiceId)?.gender ?? "";
  if (!gender && voiceId) gender = (await voice.listVoices().catch(() => [])).find((v) => v.id === voiceId)?.gender ?? "";
  const prompt = buildPrompt({
    identity: { name: agent.name, gender },
    safetyRules: settings?.safety_rules ?? "",
    typePrompt: type.prompt,
    business: {
      name: client.name,
      industry: client.industry,
      address: client.address,
      hours: (client.business_hours as { summary?: string } | null)?.summary ?? "",
      phone: client.contact_phone,
    },
    customPrompt: agent.custom_prompt,
    automationInstructions: (automations ?? [])
      .map((a) => (a.spec as { instruction?: string; agent_id?: string | null }) ?? {})
      .filter((sp) => sp.instruction?.trim() && (!sp.agent_id || sp.agent_id === agent.id))
      .map((sp) => sp.instruction as string),
  });
  if (!type.prompt.trim() && !agent.custom_prompt.trim()) {
    throw new Error(`הפרומפט של "${type.name}" ריק. כותבים אותו בניהול ← סוכני AI.`);
  }
  const other = namedBusiness(prompt, (others ?? []).map((o) => o.name));
  if (other) throw new Error(`הפרומפט מזכיר עסק אחר ("${other}"), ולכן לא נשלח.`);

  if (!voiceId) throw new Error(`לא נבחר קול ל"${type.name}". בוחרים קול ברירת מחדל בניהול ← סוכני AI.`);

  const mine = knowledge.items.filter(
    (i) => i.provider_doc_id && (i.all_agents || knowledge.links.some((l) => l.item_id === i.id && l.agent_id === agent.id)),
  );
  const realtimeModel = realtimeFor(agent.realtime_model_override, type.realtime_model);
  // The provider transfers only between agents of the same mode (Realtime ↔ Realtime).
  const transfers = peers
    .filter((p) => p.id !== agent.id && p.active && p.providerId && p.realtime === Boolean(realtimeModel))
    .map((p) => ({
      agentId: p.providerId as string,
      condition: `כשהפונה צריך ${p.typeName}${p.purpose ? ` (${p.purpose})` : ""} ולא אתה מטפל בזה. שם הסוכן: ${p.name}.`,
      message: `רגע, אני מעביר אותך ל${p.name}.`,
    }));
  const config: voice.AgentConfig = {
    name: `${client.name} · ${agent.name}`,
    prompt,
    firstMessage: agent.opening_line,
    language: type.language || "he",
    llm: agent.llm_model_override || type.llm_model,
    voiceId,
    ttsModel: type.tts_model || "eleven_v4_turbo",
    realtimeModel,
    voiceSettings: (type.voice_settings ?? {}) as voice.AgentConfig["voiceSettings"],
    turn: (type.conversation_settings ?? {}) as voice.AgentConfig["turn"],
    knowledge: mine.map((i) => ({ id: i.provider_doc_id as string, name: i.title })),
    tags: [`client:${client.slug}`, `type:${agent.type_key}`],
    transfers,
    dataCollection: CALLBACK_FIELDS,
  };

  // If the provider rejects the hand-over or the call-back settings, the agent is still
  // saved without them (first without the hand-over, then without both).
  const rejected = (e: unknown) => e instanceof voice.VoiceProviderError && (e.status === 400 || e.status === 422);
  const send = async <T,>(fn: (c: voice.AgentConfig) => Promise<T>): Promise<T> => {
    try {
      return await fn(config);
    } catch (e) {
      if (!rejected(e)) throw e;
      console.error("sync: retrying without transfer tool", (e as Error).message);
      try {
        return await fn({ ...config, transfers: [], omitTransferTool: true });
      } catch (e2) {
        if (!rejected(e2)) throw e2;
        console.error("sync: retrying without call-back fields", (e2 as Error).message);
        return fn({ ...config, transfers: [], omitTransferTool: true, dataCollection: undefined });
      }
    }
  };
  if (agent.provider_agent_id) {
    const pid = agent.provider_agent_id;
    await send((c) => voice.updateAgent(pid, c));
    return false;
  } else {
    const id = await send((c) => voice.createAgent(c));
    await db.from("agents").update({ provider_agent_id: id }).eq("id", agent.id);
    agent.provider_agent_id = id;
    return true;
  }
}

const AGENT_COLUMNS =
  "id, client_id, type_key, name, status, voice_id, opening_line, llm_model_override, realtime_model_override, custom_prompt, provider_agent_id";

/** The agent's override wins; 'custom' forces the custom pipeline even when the type is Realtime. */
export function realtimeFor(override: string | null, typeModel: string | null | undefined): string | null {
  if (override === "custom") return null;
  if (override && isRealtimeModel(override)) return override;
  return typeModel && isRealtimeModel(typeModel) ? typeModel : null;
}

/** Brings every active agent of a client up to date with the voice provider. */
export async function syncClient(clientId: string): Promise<SyncResult> {
  if (!(await voice.isVoiceConfigured())) return { ok: true };
  const db = createAdminClient();
  const { data } = await db.from("agents").select(AGENT_COLUMNS).eq("client_id", clientId).neq("status", "draft");
  const agents = (data ?? []) as AgentFull[];
  if (agents.length === 0) return { ok: true };

  let knowledge;
  try {
    knowledge = await syncKnowledge(db, clientId);
  } catch (e) {
    await db.from("agents").update({ sync_status: "failed", sync_error: message(e) }).in("id", agents.map((a) => a.id));
    return { ok: false, error: message(e) };
  }
  const { data: types } = await db.from("agent_types").select("key, name, purpose, realtime_model");
  const peers: Peer[] = agents.map((a) => {
    const t = (types ?? []).find((x) => x.key === a.type_key);
    return {
      id: a.id,
      providerId: a.provider_agent_id,
      name: a.name,
      typeName: t?.name ?? "",
      purpose: t?.purpose ?? "",
      realtime: Boolean(realtimeFor(a.realtime_model_override, t?.realtime_model)),
      active: a.status === "active",
    };
  });
  let firstError: string | null = null;
  const failed = new Set<string>();
  const pushAll = async () => {
    let created = false;
    for (const agent of agents) {
      try {
        if (await pushAgent(db, agent, knowledge, peers)) {
          created = true;
          const p = peers.find((x) => x.id === agent.id);
          if (p) p.providerId = agent.provider_agent_id;
        }
        failed.delete(agent.id);
        await db.from("agents").update({ sync_status: "ok", sync_error: null, synced_at: new Date().toISOString() }).eq("id", agent.id);
      } catch (e) {
        failed.add(agent.id);
        firstError ??= message(e);
        await db.from("agents").update({ sync_status: "failed", sync_error: message(e) }).eq("id", agent.id);
      }
    }
    return created;
  };
  // An agent created in this run can only be a transfer target for the others on a second pass.
  if ((await pushAll()) && agents.length > 1) {
    firstError = null;
    await pushAll();
  }
  await flushTrash(db);
  const routed = await routeClientNumbers(clientId);
  firstError ??= routed.ok ? null : `ניתוב המספרים: ${routed.error}`;
  return firstError ? { ok: false, error: firstError } : { ok: true };
}

/** After a change to an agent type: every client with an active agent of that type. */
export async function syncType(typeKey: string): Promise<{ failed: number }> {
  if (!(await voice.isVoiceConfigured())) return { failed: 0 };
  const db = createAdminClient();
  const { data } = await db.from("agents").select("client_id").eq("type_key", typeKey).neq("status", "draft");
  let failed = 0;
  for (const clientId of new Set((data ?? []).map((a) => a.client_id as string))) {
    if (!(await syncClient(clientId)).ok) failed++;
  }
  return { failed };
}

/** After a change to the shared safety rules: every client with an active agent. */
export async function syncAll(): Promise<{ failed: number }> {
  if (!(await voice.isVoiceConfigured())) return { failed: 0 };
  const db = createAdminClient();
  const { data } = await db.from("agents").select("client_id").neq("status", "draft");
  let failed = 0;
  for (const clientId of new Set((data ?? []).map((a) => a.client_id as string))) {
    if (!(await syncClient(clientId)).ok) failed++;
  }
  return { failed };
}

/**
 * Turns an agent on for its client: this is the moment it is created at the voice
 * provider. Nothing is sent before.
 */
export async function activateAgent(agentId: string): Promise<SyncResult> {
  if (!(await voice.isVoiceConfigured())) return { ok: false, error: "שירות הקול עוד לא מחובר. מגדירים מפתח בהגדרות ← ספקים." };
  const db = createAdminClient();
  const { data: agent } = await db.from("agents").select("client_id, status").eq("id", agentId).single();
  if (!agent) return { ok: false, error: "הסוכן לא נמצא" };
  const previous = agent.status;
  await db.from("agents").update({ status: "active", sync_status: "pending" }).eq("id", agentId);
  const res = await syncClient(agent.client_id);
  const { data: after } = await db.from("agents").select("sync_status, sync_error, provider_agent_id").eq("id", agentId).single();
  if (after?.sync_status !== "ok") {
    // Not created at the provider: leave it as it was.
    if (!after?.provider_agent_id) await db.from("agents").update({ status: previous }).eq("id", agentId);
    return { ok: false, error: after?.sync_error ?? (res.ok ? "ההפעלה נכשלה" : res.error) };
  }
  return { ok: true };
}

/** Turns an agent off. It stays at the provider (no number reaches it), so turning it on again is quick. */
export async function pauseAgent(agentId: string): Promise<SyncResult> {
  const db = createAdminClient();
  const { data: agent, error } = await db.from("agents").update({ status: "paused" }).eq("id", agentId).select("client_id").single();
  if (error || !agent) return { ok: false, error: "השמירה נכשלה" };
  // Its numbers stop reaching it, and the other agents stop transferring to it.
  const res = await syncClient(agent.client_id);
  return res.ok ? { ok: true } : { ok: false, error: `הסוכן כבוי, אבל העדכון נכשל: ${res.error}` };
}

/** Before a client is deleted: its agents and documents at the provider. */
export async function removeClientFromProvider(clientId: string): Promise<SyncResult> {
  if (!(await voice.isVoiceConfigured())) return { ok: true };
  const db = createAdminClient();
  const [{ data: agents }, { data: items }, { data: numbers }] = await Promise.all([
    db.from("agents").select("provider_agent_id").eq("client_id", clientId).not("provider_agent_id", "is", null),
    db.from("knowledge_items").select("provider_doc_id").eq("client_id", clientId).not("provider_doc_id", "is", null),
    db.from("phone_numbers").select("provider_phone_id").eq("client_id", clientId).not("provider_phone_id", "is", null),
  ]);
  try {
    for (const n of numbers ?? []) await voice.deleteNumber(n.provider_phone_id as string);
    for (const a of agents ?? []) await voice.deleteAgent(a.provider_agent_id as string);
    for (const i of items ?? []) await voice.deleteKnowledge(i.provider_doc_id as string);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

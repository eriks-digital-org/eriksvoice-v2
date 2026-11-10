"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AGENT_TYPE_KEYS, type AgentTypeKey } from "@/lib/agent-types";
import { namedBusiness } from "@/lib/agents/prompt";
import { syncType } from "@/lib/agents/sync";
import { HEBREW_TTS_MODELS, isRealtimeModel, type AllowedVoice } from "@/lib/voice/models";

export type SaveState = { error?: string; ok?: string };

const num = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return v === null || v === "" || Number.isNaN(n) ? undefined : n;
};

export async function saveAgentType(_: SaveState, form: FormData): Promise<SaveState> {
  const access = await requireAdmin();
  const key = String(form.get("key")) as AgentTypeKey;
  if (!AGENT_TYPE_KEYS.includes(key)) return { error: "סוג לא מוכר" };

  const prompt = String(form.get("prompt") ?? "");
  const db = createAdminClient();
  const { data: clients } = await db.from("clients").select("name");
  const named = namedBusiness(prompt, (clients ?? []).map((c) => c.name));
  if (named) return { error: `הפרומפט מזכיר את העסק "${named}". תבנית משותפת לכל הלקוחות, ולכן לא מזכירה שם של עסק.` };

  const tts = String(form.get("tts_model") ?? "eleven_v4_turbo");
  if (!HEBREW_TTS_MODELS.some((m) => m.id === tts)) return { error: "מודל הדיבור הזה לא מדבר עברית" };

  const realtime = String(form.get("realtime_model") ?? "");
  if (realtime && !isRealtimeModel(realtime)) return { error: "מצב דיבור לא מוכר" };

  let allowed: AllowedVoice[] = [];
  try {
    allowed = JSON.parse(String(form.get("allowed_voices") || "[]"));
  } catch {
    return { error: "רשימת הקולות לא תקינה" };
  }
  const defaultVoice = String(form.get("default_voice_id") ?? "").trim();

  const voiceSettings = Object.fromEntries(
    Object.entries({ stability: num(form.get("stability")), speed: num(form.get("speed")), similarity_boost: num(form.get("similarity_boost")) }).filter(
      ([, v]) => v !== undefined,
    ),
  );
  const turn = Object.fromEntries(
    Object.entries({
      turn_timeout: num(form.get("turn_timeout")),
      silence_end_call_timeout: num(form.get("silence_end_call_timeout")),
      turn_eagerness: String(form.get("turn_eagerness") || "") || undefined,
    }).filter(([, v]) => v !== undefined),
  );

  const { error } = await db
    .from("agent_types")
    .update({
      name: String(form.get("name") ?? "").trim(),
      purpose: String(form.get("purpose") ?? "").trim(),
      prompt,
      llm_model: String(form.get("llm_model") ?? "").trim(),
      default_voice_id: defaultVoice,
      allowed_voices: allowed,
      allowed_voice_ids: allowed.map((v) => v.id),
      tts_model: tts,
      realtime_model: realtime,
      voice_settings: voiceSettings,
      conversation_settings: turn,
      updated_by: access.userId,
    })
    .eq("key", key);
  if (error) return { error: "השמירה נכשלה" };

  // Goes live at once for every active agent of this type, at every client.
  const { failed } = await syncType(key);
  revalidatePath("/admin/agents");
  revalidatePath(`/admin/agents/${key}`);
  return failed
    ? { ok: `נשמר, אבל העדכון נכשל אצל ${failed} לקוחות. הפרטים במסך הלקוח.` }
    : { ok: "נשמר ועודכן אצל כל הסוכנים מהסוג הזה" };
}

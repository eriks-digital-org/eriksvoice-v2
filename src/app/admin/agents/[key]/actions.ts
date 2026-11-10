"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AGENT_TYPE_KEYS, type AgentTypeKey } from "@/lib/agent-types";

export type SaveState = { error?: string; ok?: string };

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveAgentType(_: SaveState, form: FormData): Promise<SaveState> {
  const access = await requireAdmin();
  const key = String(form.get("key")) as AgentTypeKey;
  if (!AGENT_TYPE_KEYS.includes(key)) return { error: "סוג לא מוכר" };

  const prompt = String(form.get("prompt") ?? "");
  // A shared template must not name a business.
  const db = createAdminClient();
  const { data: clients } = await db.from("clients").select("name");
  const named = (clients ?? []).find((c) => c.name.trim().length > 2 && prompt.includes(c.name.trim()));
  if (named) return { error: `הפרומפט מזכיר את העסק "${named.name}". תבנית משותפת לכל הלקוחות, ולכן לא מזכירה שם של עסק.` };

  const { error } = await db
    .from("agent_types")
    .update({
      name: String(form.get("name") ?? "").trim(),
      purpose: String(form.get("purpose") ?? "").trim(),
      prompt,
      llm_model: String(form.get("llm_model") ?? "").trim(),
      default_voice_id: String(form.get("default_voice_id") ?? "").trim(),
      allowed_voice_ids: list(form.get("allowed_voice_ids")),
      updated_by: access.userId,
    })
    .eq("key", key);
  if (error) return { error: "השמירה נכשלה" };
  // Active agents of this type are queued for sync by the sync layer (next phase).
  revalidatePath("/admin/agents");
  revalidatePath(`/admin/agents/${key}`);
  return { ok: "נשמר" };
}

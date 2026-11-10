"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { syncClient } from "@/lib/agents/sync";

export type SaveState = { error?: string; ok?: string };

/** The client changes only the agent's name, voice (from the admin's list) and opening line. */
export async function saveAgent(_: SaveState, form: FormData): Promise<SaveState> {
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  const id = String(form.get("id"));
  const name = String(form.get("name") ?? "").trim();
  const opening = String(form.get("opening_line") ?? "").trim();
  const voiceId = String(form.get("voice_id") ?? "");
  if (name.length < 2) return { error: "השם קצר מדי" };
  if (opening.length > 500) return { error: "משפט הפתיח ארוך מדי" };
  const supabase = await createClient();
  // RLS lets a user update only agents of their own clients, only these columns,
  // and the database accepts only a voice the admin allowed for the agent's type.
  const { error, count } = await supabase
    .from("agents")
    .update({ name, opening_line: opening, ...(voiceId ? { voice_id: voiceId } : {}) }, { count: "exact" })
    .eq("id", id)
    .eq("client_id", client.id);
  if (error) return { error: error.message.includes("voice not allowed") ? "הקול הזה לא זמין" : "השמירה נכשלה" };
  if (!count) return { error: "השמירה נכשלה" };
  const res = await syncClient(client.id);
  revalidatePath(`/${slug}/team`);
  return res.ok ? { ok: "נשמר" } : { ok: "נשמר. העדכון לסוכן יושלם בקרוב." };
}

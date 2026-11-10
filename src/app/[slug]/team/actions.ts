"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveState = { error?: string; ok?: string };

/** The client may change only the agent's name and opening line here (voice: from the admin's list). */
export async function saveAgent(_: SaveState, form: FormData): Promise<SaveState> {
  const id = String(form.get("id"));
  const slug = String(form.get("slug"));
  const name = String(form.get("name") ?? "").trim();
  const opening = String(form.get("opening_line") ?? "").trim();
  if (name.length < 2) return { error: "השם קצר מדי" };
  if (opening.length > 500) return { error: "משפט הפתיח ארוך מדי" };
  const supabase = await createClient();
  // RLS lets a user update only agents of their own clients, and only these columns.
  const { error, count } = await supabase
    .from("agents")
    .update({ name, opening_line: opening }, { count: "exact" })
    .eq("id", id);
  if (error || !count) return { error: "השמירה נכשלה" };
  revalidatePath(`/${slug}/team`);
  return { ok: "נשמר" };
}

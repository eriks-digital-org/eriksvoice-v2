"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";

export type SaveState = { error?: string; ok?: string };

/** Add or edit a free-text item. Changes go live without admin approval (the sync layer pushes them). */
export async function saveItem(_: SaveState, form: FormData): Promise<SaveState> {
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!title) return { error: "חסרה כותרת" };
  if (body.length > 50_000) return { error: "הטקסט ארוך מדי" };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("knowledge_items").update({ title, body }).eq("id", id).eq("client_id", client.id)
    : await supabase.from("knowledge_items").insert({ client_id: client.id, title, body });
  if (error) return { error: "השמירה נכשלה" };
  revalidatePath(`/${slug}/knowledge`);
  return { ok: id ? "נשמר" : "נוסף" };
}

export async function deleteItem(form: FormData) {
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  const supabase = await createClient();
  await supabase.from("knowledge_items").delete().eq("id", String(form.get("id"))).eq("client_id", client.id);
  revalidatePath(`/${slug}/knowledge`);
}

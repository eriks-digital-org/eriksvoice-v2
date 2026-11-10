"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteMember } from "@/lib/data/members";

export type ActionState = { error?: string; ok?: string };

export async function inviteAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "מייל לא תקין" };
  const res = await inviteMember(clientId, email);
  if (!res.ok) return { error: res.error };
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: "ההזמנה נשלחה" };
}

/** Full delete, after the admin typed the client's name. */
export async function deleteClientAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  const typed = String(form.get("confirm") ?? "").trim();
  const db = createAdminClient();
  const { data: client } = await db.from("clients").select("name").eq("id", clientId).maybeSingle();
  if (!client) return { error: "הלקוח לא נמצא" };
  if (typed !== client.name.trim()) return { error: "השם שהוקלד לא תואם לשם הלקוח" };
  // Agents that exist at the voice provider are removed there by the sync layer (next phase).
  const { error } = await db.from("clients").delete().eq("id", clientId);
  if (error) return { error: "המחיקה נכשלה" };
  redirect("/admin/clients");
}

export async function setStatusAction(form: FormData) {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  const status = String(form.get("status"));
  if (!["onboarding", "active", "paused"].includes(status)) return;
  await createAdminClient().from("clients").update({ status }).eq("id", clientId);
  revalidatePath(`/admin/clients/${clientId}`);
}

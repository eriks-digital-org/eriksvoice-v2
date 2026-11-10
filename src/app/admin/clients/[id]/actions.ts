"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteMember } from "@/lib/data/members";
import { activateAgent, pauseAgent, removeClientFromProvider, syncClient } from "@/lib/agents/sync";

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
  const removed = await removeClientFromProvider(clientId);
  if (!removed.ok) return { error: `מחיקת הסוכנים בשירות הקול נכשלה: ${removed.error}` };
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

async function clientOfAgent(agentId: string) {
  const { data } = await createAdminClient().from("agents").select("client_id").eq("id", agentId).maybeSingle();
  return data?.client_id as string | undefined;
}

/** Turn an agent on (creates it at the voice service) or off. */
export async function agentPowerAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const agentId = String(form.get("agent_id"));
  const on = form.get("on") === "1";
  const clientId = await clientOfAgent(agentId);
  if (!clientId) return { error: "הסוכן לא נמצא" };
  const res = on ? await activateAgent(agentId) : await pauseAgent(agentId);
  revalidatePath(`/admin/clients/${clientId}`);
  return res.ok ? { ok: on ? "הסוכן פעיל" : "הסוכן כבוי" } : { error: res.error };
}

/** Admin overrides for one agent: voice and conversation model. */
export async function agentOverrideAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const agentId = String(form.get("agent_id"));
  const clientId = await clientOfAgent(agentId);
  if (!clientId) return { error: "הסוכן לא נמצא" };
  const db = createAdminClient();
  const { error } = await db
    .from("agents")
    .update({
      name: String(form.get("name") ?? "").trim() || undefined,
      voice_id: String(form.get("voice_id") ?? "") || null,
      llm_model_override: String(form.get("llm_model_override") ?? "") || null,
      custom_prompt: String(form.get("custom_prompt") ?? ""),
      opening_line: String(form.get("opening_line") ?? "").trim(),
    })
    .eq("id", agentId);
  if (error) return { error: "השמירה נכשלה" };
  const res = await syncClient(clientId);
  revalidatePath(`/admin/clients/${clientId}`);
  return res.ok ? { ok: "נשמר" } : { error: `נשמר, אבל העדכון בשירות הקול נכשל: ${res.error}` };
}

export async function resyncAction(form: FormData) {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  await syncClient(clientId);
  revalidatePath(`/admin/clients/${clientId}`);
}

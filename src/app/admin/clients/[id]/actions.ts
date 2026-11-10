"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteMember } from "@/lib/data/members";
import { activateAgent, pauseAgent, removeClientFromProvider, syncClient } from "@/lib/agents/sync";
import { outboundNumberFor, releaseNumber, routeClientNumbers } from "@/lib/agents/phones";
import { twilioCredentials } from "@/lib/telephony/twilio";
import * as voice from "@/lib/voice/elevenlabs";
import { isRealtimeModel } from "@/lib/voice/models";

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

const realtimeOverride = (v: string) => (v === "custom" || isRealtimeModel(v) ? v : null);

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
      realtime_model_override: realtimeOverride(String(form.get("realtime_model_override") ?? "")),
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

// ---------------------------------------------------------------- numbers and routing

/** Adds a number bought at Twilio to this client. A number belongs to one business only. */
export async function addNumberAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  const e164 = String(form.get("e164") ?? "").replace(/[\s-]/g, "");
  const sid = String(form.get("sid") ?? "") || null;
  const agentId = String(form.get("agent_id") ?? "") || null;
  if (!/^\+[1-9][0-9]{6,14}$/.test(e164)) return { error: "מספר בפורמט בינלאומי, למשל +972501234567" };
  const db = createAdminClient();
  const { count } = await db.from("phone_numbers").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  const { error } = await db
    .from("phone_numbers")
    .insert({ client_id: clientId, e164, provider_sid: sid, agent_id: agentId, is_primary: (count ?? 0) === 0 });
  if (error) return { error: error.code === "23505" ? "המספר הזה כבר שייך לעסק אחר" : "השמירה נכשלה" };
  const routed = await routeClientNumbers(clientId);
  revalidatePath(`/admin/clients/${clientId}`);
  return routed.ok ? { ok: "המספר נוסף" } : { error: `המספר נוסף, אבל הניתוב נכשל: ${routed.error}` };
}

export async function updateNumberAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("phone_id"));
  const db = createAdminClient();
  const { data: row } = await db.from("phone_numbers").select("client_id").eq("id", id).maybeSingle();
  if (!row) return { error: "המספר לא נמצא" };
  const agentId = String(form.get("agent_id") ?? "") || null;
  const primary = form.get("is_primary") === "1";
  if (primary) await db.from("phone_numbers").update({ is_primary: false }).eq("client_id", row.client_id).neq("id", id);
  const { error } = await db.from("phone_numbers").update({ agent_id: agentId, ...(primary ? { is_primary: true } : {}) }).eq("id", id);
  if (error) return { error: "השמירה נכשלה" };
  const routed = await routeClientNumbers(row.client_id);
  revalidatePath(`/admin/clients/${row.client_id}`);
  return routed.ok ? { ok: "נשמר" } : { error: `נשמר, אבל הניתוב נכשל: ${routed.error}` };
}

export async function removeNumberAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("phone_id"));
  const db = createAdminClient();
  const { data: row } = await db.from("phone_numbers").select("client_id, is_primary").eq("id", id).maybeSingle();
  if (!row) return;
  await releaseNumber(id).catch(() => undefined);
  await db.from("phone_numbers").delete().eq("id", id);
  if (row.is_primary) {
    const { data: next } = await db.from("phone_numbers").select("id").eq("client_id", row.client_id).limit(1).maybeSingle();
    if (next) await db.from("phone_numbers").update({ is_primary: true }).eq("id", next.id);
  }
  revalidatePath(`/admin/clients/${row.client_id}`);
}

/** Admin only: a real test call from an agent to a phone. */
export async function testCallAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const agentId = String(form.get("agent_id"));
  const to = String(form.get("to") ?? "").replace(/[\s-]/g, "");
  if (!/^\+[1-9][0-9]{6,14}$/.test(to)) return { error: "מספר יעד בפורמט בינלאומי, למשל +972501234567" };
  const db = createAdminClient();
  const { data: agent } = await db.from("agents").select("client_id, status, provider_agent_id").eq("id", agentId).maybeSingle();
  if (!agent?.provider_agent_id || agent.status !== "active") return { error: "קודם מפעילים את הסוכן" };
  let number = await outboundNumberFor(agentId);
  if (!number) return { error: "ללקוח אין מספר טלפון" };
  if (!number.provider_phone_id) {
    // Not imported yet (it has no active agent): import it now so the agent can call out from it.
    try {
      const { sid, token } = twilioCredentials();
      const phoneId = await voice.importTwilioNumber({ number: number.e164, label: number.e164, sid, token });
      await db.from("phone_numbers").update({ provider_phone_id: phoneId }).eq("id", number.id);
      await voice.routeNumber(phoneId, null);
      number = { ...number, provider_phone_id: phoneId };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "ייבוא המספר נכשל" };
    }
  }
  try {
    await voice.outboundCall({ agentId: agent.provider_agent_id, phoneId: number.provider_phone_id as string, to });
    return { ok: `השיחה יוצאת מ־${number.e164}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השיחה לא יצאה" };
  }
}

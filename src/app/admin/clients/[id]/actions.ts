"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUser, inviteMember, removeMember, resetMemberPassword, type MemberResult } from "@/lib/data/members";
import { activateAgent, pauseAgent, removeClientFromProvider, syncClient } from "@/lib/agents/sync";
import { callOut, releaseNumber, routeClientNumbers } from "@/lib/agents/phones";
import { isRealtimeModel } from "@/lib/voice/models";
import { refreshLiveCalls } from "@/lib/calls/live";
import { saveCrmHookSecret, saveCrmKey } from "@/lib/crm/erikscrm";

export type ActionState = { error?: string; ok?: string; password?: string };

/** The admin sees the temporary password once, in case the email did not arrive. */
function passwordState(res: Extract<MemberResult, { ok: true }>, sent: string): ActionState {
  if (!res.tempPassword) return { ok: res.emailed ? sent : "בוצע (המייל לא נשלח)" };
  return {
    ok: res.emailed ? `${sent} הסיסמה הזמנית, אם צריך למסור אותה ידנית:` : "המייל לא נשלח (בודקים את Utobo). מוסרים למשתמש את הסיסמה הזמנית:",
    password: res.tempPassword,
  };
}

export async function inviteAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "מייל לא תקין" };
  const res = await inviteMember(clientId, email);
  if (!res.ok) return { error: res.error };
  revalidatePath(`/admin/clients/${clientId}`);
  if (!res.tempPassword) return { ok: "המשתמש כבר קיים במערכת, ונוסף ללקוח הזה" };
  return passwordState(res, "נשלח מייל בעברית עם סיסמה זמנית.");
}

/** Reset / remove / delete one user of a client. */
export async function memberAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  const userId = String(form.get("user_id"));
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { error: "משתמש לא תקין" };
  const op = String(form.get("op"));
  const res =
    op === "reset" ? await resetMemberPassword(userId) : op === "remove" ? await removeMember(clientId, userId) : op === "delete" ? await deleteUser(userId) : null;
  if (!res) return { error: "פעולה לא מוכרת" };
  if (!res.ok) return { error: res.error };
  revalidatePath(`/admin/clients/${clientId}`);
  if (op === "reset") return passwordState(res, "נשלחה סיסמה זמנית חדשה במייל.");
  return { ok: op === "remove" ? "הוסר מהלקוח" : "המשתמש נמחק" };
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
  // The client's CRM key and webhook secret (Vault).
  await Promise.all([saveCrmKey(clientId, ""), saveCrmHookSecret(clientId, "")]).catch((e) => console.error("crm secrets cleanup", e));
  redirect("/admin/clients");
}

export async function setStatusAction(form: FormData) {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  const status = String(form.get("status"));
  if (!["onboarding", "active", "paused"].includes(status)) return;
  await createAdminClient().from("clients").update({ status }).eq("id", clientId);
  // Paused: numbers stop reaching the agents. Active again: they reach them again.
  const routed = await routeClientNumbers(clientId);
  if (!routed.ok) console.error("client status: routing", routed.error);
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
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
  const r = await callOut(agentId, to);
  if (!r.ok) return { error: r.error };
  // Wait a few seconds and ask Twilio, so a call that never rang is reported here, with the reason.
  if (r.callId) {
    for (let i = 0; i < 4; i++) {
      await new Promise((ok) => setTimeout(ok, 2500));
      await refreshLiveCalls(undefined).catch(() => 0);
      const { data: c } = await createAdminClient().from("calls").select("status, end_reason").eq("id", r.callId).single();
      if (c && c.status !== "calling") {
        if (c.status === "failed" || c.status === "no_answer") return { error: `השיחה לא יצאה: ${c.end_reason || "ללא פירוט"}` };
        return { ok: `השיחה יוצאת מ־${r.from} (${c.status === "ringing" ? "מצלצלת" : "בשיחה"}). אפשר לעקוב ולנתק במסך השיחות.` };
      }
    }
  }
  return { ok: `השיחה נשלחה מ־${r.from}. אם לא צלצל תוך דקה, במסך השיחות תופיע הסיבה.` };
}

/** The client's Activepieces flow (its webhook address), used by the "Activepieces" action. */
export async function flowUrlAction(form: FormData) {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  const url = String(form.get("flow_url") ?? "").trim();
  if (url && !/^https:\/\/[^\s]+$/i.test(url)) return;
  const db = createAdminClient();
  await db
    .from("connections")
    .upsert({ client_id: clientId, kind: "activepieces", flow_url: url || null, status: url ? "configured" : "off" }, { onConflict: "client_id,kind" });
  revalidatePath(`/admin/clients/${clientId}`);
}

/** The admin sets a client's connection status after connecting it in Activepieces (and testing). */
export async function connectionStatusAction(form: FormData) {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  const kind = String(form.get("kind"));
  const status = String(form.get("status"));
  if (!["off", "requested", "configured", "connected", "error"].includes(status)) return;
  const note = String(form.get("note") ?? "").trim().slice(0, 300);
  const db = createAdminClient();
  await db.from("connections").upsert(
    {
      client_id: clientId,
      kind,
      status,
      last_error: status === "error" ? note || null : null,
      ...(status === "connected" ? { tested_at: new Date().toISOString() } : {}),
    },
    { onConflict: "client_id,kind" },
  );
  revalidatePath(`/admin/clients/${clientId}`);
}

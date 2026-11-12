"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import * as crm from "@/lib/crm/erikscrm";
import type { AutomationSpec } from "@/lib/automations/catalog";

export type CrmState = { error?: string; ok?: string; secret?: string };

const uuid = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
};

async function setConnection(clientId: string, patch: Record<string, unknown>) {
  await createAdminClient().from("connections").upsert({ client_id: clientId, kind: "erikscrm", ...patch }, { onConflict: "client_id,kind" });
}

/** Saves the business's CRM key after checking it with the CRM; an empty key disconnects. */
export async function crmKeyAction(_: CrmState, form: FormData): Promise<CrmState> {
  await requireAdmin();
  const clientId = uuid(form.get("client_id"));
  if (!clientId) return { error: "לקוח לא תקין" };
  const key = String(form.get("key") ?? "").trim();
  if (form.get("disconnect")) {
    await crm.saveCrmKey(clientId, "");
    await setConnection(clientId, { status: "off", last_error: null });
    revalidatePath(`/admin/clients/${clientId}`);
    return { ok: "ה־CRM נותק ללקוח הזה" };
  }
  if (key.length < 10 || key.length > 500) return { error: "מדביקים את המפתח שנוצר ב־CRM (לידים ← הגדרות העסק ← EriksVoice)" };
  try {
    const s = await crm.statuses(clientId, key);
    await crm.saveCrmKey(clientId, key);
    await setConnection(clientId, { status: "connected", last_error: null, tested_at: new Date().toISOString() });
    revalidatePath(`/admin/clients/${clientId}`);
    return { ok: `מחובר. הסטטוסים ב־CRM של העסק: ${s.statuses.join(", ") || "אין"}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הבדיקה מול ה־CRM נכשלה" };
  }
}

/** Checks the saved key again. */
export async function crmTestAction(_: CrmState, form: FormData): Promise<CrmState> {
  await requireAdmin();
  const clientId = uuid(form.get("client_id"));
  if (!clientId) return { error: "לקוח לא תקין" };
  try {
    const s = await crm.statuses(clientId);
    await setConnection(clientId, { status: "connected", last_error: null, tested_at: new Date().toISOString() });
    revalidatePath(`/admin/clients/${clientId}`);
    return { ok: `עובד. סטטוסים: ${s.statuses.join(", ") || "אין"}. שלבים: ${s.process_steps.join(", ") || "אין"}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "הבדיקה נכשלה";
    await setConnection(clientId, { status: "error", last_error: msg.slice(0, 300) });
    revalidatePath(`/admin/clients/${clientId}`);
    return { error: msg };
  }
}

/** A new signing secret for the CRM's webhook, shown once to paste in the CRM. */
export async function crmHookSecretAction(_: CrmState, form: FormData): Promise<CrmState> {
  await requireAdmin();
  const clientId = uuid(form.get("client_id"));
  if (!clientId) return { error: "לקוח לא תקין" };
  const secret = randomBytes(32).toString("hex");
  await crm.saveCrmHookSecret(clientId, secret);
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: "סוד חדש נשמר. מעתיקים אותו עכשיו ל־CRM, הוא לא יוצג שוב.", secret };
}

/** Whether new CRM leads are added to the client's leads. */
export async function crmImportAction(form: FormData) {
  await requireAdmin();
  const clientId = uuid(form.get("client_id"));
  if (!clientId) return;
  const db = createAdminClient();
  const { data } = await db.from("connections").select("config").eq("client_id", clientId).eq("kind", "erikscrm").maybeSingle();
  const config = { ...((data?.config as object) ?? {}), import_leads: form.get("import_leads") === "on" };
  await db.from("connections").upsert({ client_id: clientId, kind: "erikscrm", config }, { onConflict: "client_id,kind" });
  revalidatePath(`/admin/clients/${clientId}`);
}

/** Adds the automation "every call is logged on the lead's card in the CRM". */
export async function crmLogCallsAutomationAction(_: CrmState, form: FormData): Promise<CrmState> {
  await requireAdmin();
  const clientId = uuid(form.get("client_id"));
  if (!clientId) return { error: "לקוח לא תקין" };
  const db = createAdminClient();
  const { data: existing } = await db.from("automations").select("id, spec").eq("client_id", clientId);
  if ((existing ?? []).some((a) => (a.spec as AutomationSpec).actions?.some((x) => x.type === "crm_log_call"))) {
    return { ok: "כבר יש ללקוח אוטומציה שרושמת שיחות ב־CRM" };
  }
  const spec: AutomationSpec = {
    trigger: { type: "call_ended", config: { direction: "any", outcome: "any" } },
    hours: { mode: "always" },
    delay_minutes: 0,
    agent_id: null,
    actions: [{ type: "crm_log_call", config: {} }],
    instruction: "",
  };
  const { error } = await db.from("automations").insert({ client_id: clientId, name: "רישום כל שיחה ב־CRM", enabled: true, spec });
  if (error) return { error: error.message };
  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: "נוספה אוטומציה: כל שיחה נרשמת בכרטיס הליד ב־CRM" };
}

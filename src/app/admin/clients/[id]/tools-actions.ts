"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncClient } from "@/lib/agents/sync";
import { CALL_TOOLS } from "@/lib/calltools/definitions";
import { toE164 } from "@/lib/phone";

export type ToolsState = { error?: string; ok?: string };

/** Which in-call tools the business's agents get, meeting length, and a person to transfer to. */
export async function saveCallToolsAction(_: ToolsState, form: FormData): Promise<ToolsState> {
  await requireAdmin();
  const clientId = String(form.get("client_id"));
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) return { error: "לקוח לא תקין" };
  const tools = CALL_TOOLS.map((t) => t.name).filter((n) => form.get(`tool_${n}`) === "on");
  const minutes = Math.round(Number(form.get("meeting_minutes")));
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 480) return { error: "אורך פגישה בין 5 ל־480 דקות" };
  const rawPhone = String(form.get("transfer_phone") ?? "").trim();
  const phone = rawPhone ? toE164(rawPhone) : "";
  if (rawPhone && !phone) return { error: "מספר ההעברה לא תקין" };
  if (tools.includes("transfer_human") && !phone) return { error: "להעברה לנציג צריך מספר טלפון" };
  const { error } = await createAdminClient()
    .from("clients")
    .update({ call_tools: tools, meeting_minutes: minutes, transfer_phone: phone ?? "", meeting_invite: form.get("meeting_invite") === "on" })
    .eq("id", clientId);
  if (error) return { error: "השמירה נכשלה" };
  const r = await syncClient(clientId);
  revalidatePath(`/admin/clients/${clientId}`);
  return r.ok ? { ok: "נשמר ועודכן בסוכנים הפעילים" } : { ok: `נשמר. עדכון הסוכנים נכשל: ${r.error}` };
}

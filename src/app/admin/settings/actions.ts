"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type SaveState = { error?: string; ok?: string };

export async function saveSettings(_: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const emails = String(form.get("alert_emails") ?? "")
    .split(/[\s,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) return { error: "יש מייל לא תקין ברשימה" };
  const { error } = await createAdminClient()
    .from("system_settings")
    .update({
      safety_rules: String(form.get("safety_rules") ?? ""),
      alert_emails: emails,
      default_business_hours: { summary: String(form.get("hours") ?? "").trim() },
    })
    .eq("id", true);
  if (error) return { error: "השמירה נכשלה" };
  revalidatePath("/admin/settings");
  return { ok: "נשמר" };
}

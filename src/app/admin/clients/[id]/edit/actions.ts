"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncClient } from "@/lib/agents/sync";

export type EditState = { error?: string; ok?: string };

const schema = z.object({
  name: z.string().trim().min(2, "שם העסק קצר מדי").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "כתובת הפורטל: אותיות באנגלית, ספרות ומקף בלבד"),
  industry: z.string().trim().max(120),
  address: z.string().trim().max(200),
  hours: z.string().trim().max(300),
  contact_phone: z.string().trim().max(30),
  notify_email: z.union([z.literal(""), z.email("מייל להתראות לא תקין")]),
  description: z.string().trim().max(5000),
  monthly_minutes: z.coerce.number().int().min(0, "מכסת דקות לא תקינה").max(1_000_000),
});

/** Saves a client's details. Details the agents use (name, industry, address, phone, hours) are sent to its live agents. */
export async function updateClientAction(_: EditState, form: FormData): Promise<EditState> {
  await requireAdmin();
  const id = String(form.get("client_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "לקוח לא תקין" };
  const parsed = schema.safeParse({
    name: form.get("name"),
    slug: form.get("slug"),
    industry: form.get("industry") ?? "",
    address: form.get("address") ?? "",
    hours: form.get("hours") ?? "",
    contact_phone: form.get("contact_phone") ?? "",
    notify_email: String(form.get("notify_email") ?? "").trim(),
    description: form.get("description") ?? "",
    monthly_minutes: form.get("monthly_minutes") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "יש שדה לא תקין" };
  const v = parsed.data;
  const db = createAdminClient();
  const { data: before } = await db.from("clients").select("slug, name, industry, address, contact_phone, business_hours").eq("id", id).maybeSingle();
  if (!before) return { error: "הלקוח לא נמצא" };

  const { error } = await db
    .from("clients")
    .update({
      name: v.name,
      slug: v.slug,
      industry: v.industry,
      address: v.address,
      business_hours: v.hours ? { summary: v.hours } : {},
      contact_phone: v.contact_phone,
      notify_email: v.notify_email,
      description: v.description,
      monthly_minutes: v.monthly_minutes,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "כתובת הפורטל הזו כבר תפוסה" };
    if (error.code === "23514") return { error: "כתובת הפורטל הזו שמורה למערכת" };
    return { error: "השמירה נכשלה" };
  }
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/clients");

  const hoursBefore = (before.business_hours as { summary?: string } | null)?.summary ?? "";
  const agentFacing =
    before.name !== v.name ||
    before.industry !== v.industry ||
    before.address !== v.address ||
    before.contact_phone !== v.contact_phone ||
    hoursBefore !== v.hours;
  const moved = before.slug !== v.slug ? ` כתובת הפורטל עכשיו eriksvoice.co.il/${v.slug}, צריך לעדכן את הלקוח.` : "";
  if (agentFacing) {
    const res = await syncClient(id);
    if (!res.ok) return { error: `הפרטים נשמרו, אבל עדכון הסוכנים נכשל: ${res.error}.${moved}` };
    return { ok: `נשמר, והסוכנים עודכנו בפרטים החדשים.${moved}` };
  }
  return { ok: `נשמר.${moved}` };
}

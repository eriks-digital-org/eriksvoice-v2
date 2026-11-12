"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AGENT_TYPE_KEYS, agentTypeLabels, type AgentTypeKey } from "@/lib/agent-types";
import { inviteMember } from "@/lib/data/members";

export type WizardState = { error?: string; field?: string };

const RESERVED = new Set([
  "admin", "login", "logout", "register", "signup", "api", "auth", "portal", "app", "www", "landing",
  "landing-assets", "agents", "bg", "brand", "work", "set-password", "forgot-password", "reset-password",
  "settings", "help", "support", "status",
]);

const schema = z.object({
  name: z.string().trim().min(2, "שם העסק קצר מדי"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "כתובת הפורטל: אותיות באנגלית, ספרות ומקף בלבד")
    .refine((s) => !RESERVED.has(s), "הכתובת הזו שמורה למערכת"),
  industry: z.string().trim().max(120),
  address: z.string().trim().max(200),
  hours: z.string().trim().max(300),
  contact_phone: z.string().trim().max(30),
  notify_email: z.union([z.literal(""), z.email("מייל להתראות לא תקין")]),
  description: z.string().trim().max(5000),
  member_email: z.union([z.literal(""), z.email("המייל של משתמש הלקוח לא תקין")]),
  member_name: z.string().trim().max(120),
  monthly_minutes: z.coerce.number().int().min(0).max(1_000_000),
  types: z.array(z.enum(AGENT_TYPE_KEYS as [AgentTypeKey, ...AgentTypeKey[]])),
  phone: z.union([z.literal(""), z.string().regex(/^\+[1-9][0-9]{6,14}$/, "מספר טלפון בפורמט בינלאומי, למשל +972501234567")]),
  inbound_type: z.string(),
});

export async function createClientAction(_: WizardState, form: FormData): Promise<WizardState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    name: form.get("name"),
    slug: form.get("slug"),
    industry: form.get("industry") ?? "",
    address: form.get("address") ?? "",
    hours: form.get("hours") ?? "",
    contact_phone: form.get("contact_phone") ?? "",
    notify_email: String(form.get("notify_email") ?? "").trim(),
    description: form.get("description") ?? "",
    member_email: String(form.get("member_email") ?? "").trim().toLowerCase(),
    member_name: form.get("member_name") ?? "",
    monthly_minutes: form.get("monthly_minutes") || 0,
    types: form.getAll("types"),
    phone: String(form.get("phone") ?? "").replace(/[\s-]/g, ""),
    inbound_type: form.get("inbound_type") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "יש שדה לא תקין", field: String(issue?.path[0] ?? "") };
  }
  const v = parsed.data;
  if (v.member_email && v.member_name.length < 2) return { error: "צריך גם שם מלא למשתמש הלקוח", field: "member_name" };
  const db = createAdminClient();

  const { data: client, error } = await db
    .from("clients")
    .insert({
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
    .select("id")
    .single();
  if (error || !client) {
    if (error?.code === "23505") return { error: "כתובת הפורטל הזו כבר תפוסה", field: "slug" };
    return { error: "שמירת הלקוח נכשלה" };
  }

  const undo = async (message: string): Promise<WizardState> => {
    await db.from("clients").delete().eq("id", client.id);
    return { error: message };
  };

  // Agents: created off (draft), saved only here. Nothing is sent to the voice service.
  const types = [...new Set(v.types)];
  let agents: { id: string; type_key: string }[] = [];
  if (types.length) {
    const { data, error: e } = await db
      .from("agents")
      .insert(types.map((t) => ({ client_id: client.id, type_key: t, name: agentTypeLabels[t] })))
      .select("id, type_key");
    if (e) return undo("יצירת הסוכנים נכשלה");
    agents = data ?? [];
  }

  // The general description is also the first item of the client's knowledge base.
  if (v.description) {
    await db.from("knowledge_items").insert({ client_id: client.id, title: "על העסק", body: v.description });
  }

  if (v.phone) {
    const inbound = agents.find((a) => a.type_key === v.inbound_type) ?? null;
    const { error: e } = await db
      .from("phone_numbers")
      .insert({ client_id: client.id, e164: v.phone, is_primary: true, agent_id: inbound?.id ?? null });
    if (e) return undo(e.code === "23505" ? "המספר הזה כבר שייך לעסק אחר" : "שמירת המספר נכשלה");
  }

  if (v.member_email) {
    const invited = await inviteMember(client.id, v.member_email, v.member_name);
    if (!invited.ok) return undo(invited.error);
  }

  redirect(`/admin/clients/${client.id}?created=1`);
}

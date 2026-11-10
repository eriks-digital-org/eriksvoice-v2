"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSpec } from "@/lib/automations/validate";
import { CATEGORIES } from "@/lib/automations/catalog";

export type TemplateState = { error?: string; ok?: string };

/**
 * Saves a template shared by all clients. Templates have no agent (each client picks its own).
 * Changing the flow bumps the version so clients see "there's an update" (applying it is opt-in).
 */
export async function saveTemplateAction(_: TemplateState, form: FormData): Promise<TemplateState> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (name.length < 2) return { error: "צריך שם" };
  const parsed = parseSpec(String(form.get("spec") ?? ""));
  if ("error" in parsed) return { error: parsed.error };
  const spec = { ...parsed.spec, agent_id: null };
  const category = String(form.get("category") ?? "leads");
  const row = {
    name,
    title: String(form.get("title") ?? "").trim().slice(0, 160),
    saves: String(form.get("saves") ?? "").trim().slice(0, 240),
    category: CATEGORIES.some((c) => c.key === category) ? category : "leads",
    sort: Number(form.get("sort")) || 0,
    hidden: form.get("hidden") === "on",
    spec,
  };
  const db = createAdminClient();
  const id = String(form.get("id") ?? "");
  if (id) {
    const { data: old } = await db.from("automation_templates").select("spec, version").eq("id", id).maybeSingle();
    if (!old) return { error: "התבנית לא נמצאה" };
    const changed = JSON.stringify(old.spec) !== JSON.stringify(spec);
    const { error } = await db.from("automation_templates").update({ ...row, ...(changed ? { version: old.version + 1 } : {}) }).eq("id", id);
    if (error) return { error: "השמירה נכשלה" };
  } else {
    const { error } = await db.from("automation_templates").insert(row);
    if (error) return { error: "השמירה נכשלה" };
  }
  revalidatePath("/admin/automations");
  redirect("/admin/automations");
}

export async function templateRowAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  const db = createAdminClient();
  // Deleting a template keeps the clients' copies (template_id becomes null).
  if (op === "delete") await db.from("automation_templates").delete().eq("id", id);
  if (op === "hide" || op === "show") await db.from("automation_templates").update({ hidden: op === "hide" }).eq("id", id);
  revalidatePath("/admin/automations");
}

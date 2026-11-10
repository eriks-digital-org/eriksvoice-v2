"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncClient } from "@/lib/agents/sync";
import { missingAgent, parseSpec } from "@/lib/automations/validate";

export type AutoState = { error?: string; ok?: string };

/** Creates or updates one of the client's automations. */
export async function saveAutomationAction(_: AutoState, form: FormData): Promise<AutoState> {
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (name.length < 2) return { error: "צריך שם" };
  const parsed = parseSpec(String(form.get("spec") ?? ""));
  if ("error" in parsed) return { error: parsed.error };
  if (missingAgent(parsed.spec)) return { error: "בוחרים סוכן שיתקשר או ישלח" };
  const db = await createClient();
  const id = String(form.get("id") ?? "");
  const templateId = String(form.get("template_id") ?? "") || null;
  const templateVersion = Number(form.get("template_version")) || null;
  if (parsed.spec.agent_id) {
    const { data: ag } = await db.from("agents").select("id").eq("id", parsed.spec.agent_id).eq("client_id", client.id).maybeSingle();
    if (!ag) return { error: "הסוכן לא נמצא" };
  }
  const { error } = id
    ? await db
        .from("automations")
        .update({ name, spec: parsed.spec, ...(templateVersion ? { template_version: templateVersion } : {}) })
        .eq("id", id)
        .eq("client_id", client.id)
    : await db.from("automations").insert({ client_id: client.id, name, spec: parsed.spec, template_id: templateId, template_version: templateVersion });
  if (error) return { error: "השמירה נכשלה" };
  if (parsed.spec.instruction?.trim() || id) await syncClient(client.id);
  revalidatePath(`/${slug}/automations`);
  redirect(`/${slug}/automations`);
}

export async function automationRowAction(form: FormData) {
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  const db = await createClient();
  const id = String(form.get("id"));
  const op = String(form.get("op"));
  if (op === "delete") await db.from("automations").delete().eq("id", id).eq("client_id", client.id);
  if (op === "on" || op === "off") await db.from("automations").update({ enabled: op === "on" }).eq("id", id).eq("client_id", client.id);
  await syncClient(client.id);
  revalidatePath(`/${slug}/automations`);
}

"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toE164 } from "@/lib/phone";
import { parseCsv } from "@/lib/csv";
import { emitNewLeads } from "@/lib/automations/leads";

export type LeadState = { error?: string; ok?: string };

const tagsOf = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);

export async function addLeadAction(_: LeadState, form: FormData): Promise<LeadState> {
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  const phone = toE164(String(form.get("phone") ?? ""));
  if (!phone) return { error: "מספר טלפון לא תקין" };
  const db = await createClient();
  const { data: added, error } = await db.from("leads").insert({
    client_id: client.id,
    name: String(form.get("name") ?? "").trim().slice(0, 120),
    phone,
    notes: String(form.get("notes") ?? "").trim().slice(0, 2000),
    tags: tagsOf(form.get("tags")),
    source: "manual",
    email: String(form.get("email") ?? "").trim().slice(0, 200),
    status: form.get("queue") === "1" ? "queued" : "new",
  }).select("id").single();
  if (error) return { error: error.code === "23505" ? "המספר כבר ברשימה" : "השמירה נכשלה" };
  await emitNewLeads([added.id]);
  revalidatePath(`/${slug}/leads`);
  return { ok: "נוסף" };
}

const NAME_HEADERS = ["name", "שם", "full name", "שם מלא", "fullname"];
const PHONE_HEADERS = ["phone", "טלפון", "mobile", "נייד", "מספר", "phone number", "מספר טלפון"];

export async function importCsvAction(_: LeadState, form: FormData): Promise<LeadState> {
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "בוחרים קובץ CSV" };
  if (file.size > 2_000_000) return { error: "הקובץ גדול מדי (עד 2MB)" };
  if (/\.xlsx?$/i.test(file.name)) return { error: "שומרים את הקובץ מאקסל כ־CSV ומעלים שוב" };
  const rows = parseCsv(await file.text());
  if (rows.length === 0) return { error: "הקובץ ריק" };

  // Find the columns by header, or guess: the column that looks like phones.
  const head = rows[0].map((h) => h.trim().toLowerCase());
  let nameCol = head.findIndex((h) => NAME_HEADERS.includes(h));
  let phoneCol = head.findIndex((h) => PHONE_HEADERS.includes(h));
  const hasHeader = nameCol >= 0 || phoneCol >= 0;
  const body = hasHeader ? rows.slice(1) : rows;
  if (phoneCol < 0) phoneCol = rows[hasHeader ? 1 : 0]?.findIndex((c) => toE164(c) !== null) ?? -1;
  if (phoneCol < 0) return { error: "לא נמצאה עמודת טלפון" };
  if (nameCol < 0) nameCol = phoneCol === 0 ? 1 : 0;

  const tags = tagsOf(form.get("tags"));
  const queue = form.get("queue") === "1";
  const seen = new Set<string>();
  const leads = [];
  let bad = 0;
  for (const r of body.slice(0, 5000)) {
    const phone = toE164(r[phoneCol] ?? "");
    if (!phone) {
      bad++;
      continue;
    }
    if (seen.has(phone)) continue;
    seen.add(phone);
    leads.push({ client_id: client.id, name: (r[nameCol] ?? "").trim().slice(0, 120), phone, tags, source: "csv", status: queue ? "queued" : "new" });
  }
  if (!leads.length) return { error: "לא נמצאו מספרים תקינים" };
  const db = await createClient();
  const { data, error } = await db.from("leads").upsert(leads, { onConflict: "client_id,phone", ignoreDuplicates: true }).select("id");
  if (error) return { error: "הייבוא נכשל" };
  await emitNewLeads((data ?? []).map((d) => d.id));
  revalidatePath(`/${slug}/leads`);
  const added = data?.length ?? 0;
  return { ok: `נוספו ${added} לידים${leads.length - added ? `, ${leads.length - added} כבר היו ברשימה` : ""}${bad ? `, ${bad} שורות בלי מספר תקין` : ""}` };
}

/** Row actions: queue, dnc, reset to new, delete. Bulk: queue every "new" lead (in a folder). */
export async function leadAction(form: FormData) {
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  const db = await createClient();
  const op = String(form.get("op"));
  const id = String(form.get("id") ?? "");
  if (op === "queue-all") {
    let q = db.from("leads").update({ status: "queued" }).eq("client_id", client.id).eq("status", "new");
    const tag = String(form.get("tag") ?? "");
    if (tag) q = q.contains("tags", [tag]);
    await q;
  } else if (op === "delete") {
    await db.from("leads").delete().eq("client_id", client.id).eq("id", id);
  } else {
    const status = { queue: "queued", dnc: "dnc", reset: "new" }[op];
    if (status) await db.from("leads").update({ status }).eq("client_id", client.id).eq("id", id).neq("status", "calling");
  }
  revalidatePath(`/${slug}/leads`);
}

const hm = (v: FormDataEntryValue | null) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? ""));
  return m ? Math.min(1440, Number(m[1]) * 60 + Number(m[2])) : null;
};

export async function saveDialerAction(_: LeadState, form: FormData): Promise<LeadState> {
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  const start = hm(form.get("start"));
  const end = hm(form.get("end"));
  if (start === null || end === null || end <= start) return { error: "שעות לא תקינות" };
  const days = form.getAll("days").map(Number).filter((d) => d >= 0 && d <= 6);
  if (!days.length) return { error: "בוחרים לפחות יום אחד" };
  const agentId = String(form.get("agent_id") ?? "") || null;
  const enabled = form.get("enabled") === "1";
  if (enabled && !agentId) return { error: "בוחרים סוכן שיתקשר" };
  const row = {
    client_id: client.id,
    enabled,
    agent_id: agentId,
    tag: String(form.get("tag") ?? ""),
    start_minute: start,
    end_minute: end,
    days,
    max_attempts: Math.min(3, Math.max(1, Number(form.get("max_attempts")) || 3)),
    retry_minutes: Math.min(2880, Math.max(10, Number(form.get("retry_minutes")) || 120)),
  };
  const db = await createClient();
  const { data: existing } = await db.from("dialer_settings").select("client_id").eq("client_id", client.id).maybeSingle();
  const { client_id, ...patch } = row;
  void client_id;
  const { error } = existing
    ? await db.from("dialer_settings").update(patch).eq("client_id", client.id)
    : await db.from("dialer_settings").insert(row);
  if (error) return { error: "השמירה נכשלה" };
  revalidatePath(`/${slug}/leads`);
  return { ok: enabled ? "התותח פועל. שיחות יוצאות רק בשעות שנבחרו." : "נשמר. התותח כבוי." };
}

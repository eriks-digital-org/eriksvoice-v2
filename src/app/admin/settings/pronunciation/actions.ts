"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAll } from "@/lib/agents/sync";
import type { PronunciationRow } from "@/lib/voice/pronunciation";

export type PronunciationState = { error?: string; ok?: string; rows?: PronunciationRow[] };

/** Saves the whole list, then brings every active agent up to date with it. */
export async function savePronunciation(_: PronunciationState, form: FormData): Promise<PronunciationState> {
  await requireAdmin();
  let rows: PronunciationRow[];
  try {
    rows = JSON.parse(String(form.get("rows") ?? "[]"));
  } catch {
    return { error: "הרשימה לא נקראה. רעננו ונסו שוב." };
  }
  rows = rows
    .map((r) => ({
      id: r.id,
      term: String(r.term ?? "").trim(),
      say: String(r.say ?? "").trim(),
      note: String(r.note ?? "").trim(),
      category: String(r.category ?? "").trim(),
      enabled: Boolean(r.enabled),
    }))
    .filter((r) => r.term || r.say);
  const half = rows.find((r) => !r.term || !r.say);
  if (half) return { error: `בשורה "${half.term || half.say}" חסרה ${half.term ? "ההגייה" : "המילה"}` };
  const seen = new Set<string>();
  for (const r of rows) {
    const k = r.term.toLowerCase();
    if (seen.has(k)) return { error: `"${r.term}" מופיעה פעמיים. משאירים שורה אחת.` };
    seen.add(k);
  }

  const db = createAdminClient();
  const { data: existing } = await db.from("pronunciation_rules").select("id, term");
  const keep = new Set(rows.filter((r) => r.id).map((r) => r.id as string));
  const removed = (existing ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
  if (removed.length) {
    const { error } = await db.from("pronunciation_rules").delete().in("id", removed);
    if (error) return { error: "השמירה נכשלה" };
  }
  const withPos = rows.map((r, i) => ({ ...r, position: i + 1 }));
  const old = withPos.filter((r) => r.id && keep.has(r.id));
  const fresh = withPos.filter((r) => !r.id).map((r) => ({ term: r.term, say: r.say, note: r.note, category: r.category, enabled: r.enabled, position: r.position }));
  // Free the terms of renamed rows first, so swapping terms between rows doesn't collide.
  const before = new Map((existing ?? []).map((r) => [r.id as string, r.term as string]));
  for (const r of old) {
    if (before.get(r.id as string) !== r.term) await db.from("pronunciation_rules").update({ term: `__${r.id}` }).eq("id", r.id as string);
  }
  if (old.length) {
    const { error } = await db.from("pronunciation_rules").upsert(old, { onConflict: "id" });
    if (error) return { error: "השמירה נכשלה" };
  }
  if (fresh.length) {
    const { error } = await db.from("pronunciation_rules").insert(fresh);
    if (error) return { error: "השמירה נכשלה" };
  }
  const { data: saved } = await db.from("pronunciation_rules").select("id, term, say, note, category, enabled").order("position");
  const { failed } = await syncAll();
  revalidatePath("/admin/settings/pronunciation");
  return { rows: (saved ?? []) as PronunciationRow[], ok: failed ? `נשמר, אבל העדכון נכשל אצל ${failed} לקוחות` : "נשמר ועודכן בכל הסוכנים הפעילים" };
}

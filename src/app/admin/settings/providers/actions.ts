"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { PROVIDERS } from "@/lib/providers/registry";
import { setSecret } from "@/lib/providers/secrets";
import { testProvider, type TestResult } from "@/lib/providers/test";
import { resetCatalog } from "@/lib/voice/catalog";

export type ProviderState = { error?: string; ok?: string; test?: TestResult };

/** Saves the fields that were filled in (empty = keep). "clear" removes the panel value. */
export async function saveProviderAction(_: ProviderState, form: FormData): Promise<ProviderState> {
  const access = await requireAdmin();
  const def = PROVIDERS.find((p) => p.key === form.get("provider"));
  if (!def) return { error: "ספק לא מוכר" };
  const clear = String(form.get("clear") ?? "");
  try {
    if (clear) {
      if (!def.fields.some((f) => f.name === clear)) return { error: "שדה לא מוכר" };
      await setSecret(clear, "", access.userId);
    } else {
      let changed = 0;
      for (const f of def.fields) {
        const v = String(form.get(f.name) ?? "").trim();
        if (!v) continue;
        if (f.name === "elevenlabs_api_key" && !v.startsWith("sk_")) return { error: "מפתח ElevenLabs מתחיל ב־sk_. נראה שהודבק מזהה המפתח." };
        if (f.name === "activepieces_url" && !/^https:\/\/[^\s]+$/.test(v)) return { error: "כתובת מלאה שמתחילה ב־https://" };
        await setSecret(f.name, v, access.userId);
        changed++;
      }
      if (!changed) return { error: "לא הוזן ערך חדש" };
    }
  } catch (e) {
    return { error: `השמירה נכשלה: ${e instanceof Error ? e.message : ""}` };
  }
  if (def.key === "elevenlabs") resetCatalog();
  revalidatePath("/admin/settings/providers");
  const test = await testProvider(def.key, access.email);
  return { ok: clear ? "הוסר. המערכת חוזרת לערך מ־Vercel, אם יש." : "נשמר", test };
}

export async function testProviderAction(_: ProviderState, form: FormData): Promise<ProviderState> {
  const access = await requireAdmin();
  const def = PROVIDERS.find((p) => p.key === form.get("provider"));
  if (!def) return { error: "ספק לא מוכר" };
  return { test: await testProvider(def.key, access.email) };
}

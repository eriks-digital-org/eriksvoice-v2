"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type FormState = { error?: string; notice?: string };

/** Only same-site paths, so a link can't send a user elsewhere after login. */
function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "";
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "המערכת עוד לא מחוברת למסד הנתונים." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "נא למלא אימייל וסיסמה." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.code === "invalid_credentials" ? "האימייל או הסיסמה לא נכונים." : "הכניסה נכשלה. נסו שוב." };
  }
  const next = safeNext(form.get("next"));
  redirect(`/auth/continue${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

export async function sendReset(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "המערכת עוד לא מחוברת למסד הנתונים." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "נא למלא אימייל." };
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/set-password`,
  });
  // Same answer whether or not the address exists.
  return { notice: "אם הכתובת רשומה במערכת, נשלח אליה קישור לבחירת סיסמה חדשה." };
}

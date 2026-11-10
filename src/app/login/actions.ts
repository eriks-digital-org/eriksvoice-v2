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

/** A message that says what to fix, so a failed sign-in can be solved without the logs. */
function signInMessage(error: { status?: number; code?: string; message: string }): string {
  if (error.code === "invalid_credentials") return "האימייל או הסיסמה לא נכונים.";
  if (error.code === "email_not_confirmed") return "המייל עוד לא אושר. ב־Supabase אפשר לאשר את המשתמש (Auto Confirm).";
  if (/invalid api key|no api key/i.test(error.message) || error.status === 401)
    return "מפתח Supabase שהוגדר באתר לא נכון (NEXT_PUBLIC_SUPABASE_ANON_KEY).";
  if (!error.status || error.status >= 500 || /fetch failed|network/i.test(error.message))
    return "אין חיבור ל־Supabase. כדאי לבדוק את NEXT_PUBLIC_SUPABASE_URL.";
  return `הכניסה נכשלה (${error.code ?? error.status}). נסו שוב.`;
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "המערכת עוד לא מחוברת למסד הנתונים." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "נא למלא אימייל וסיסמה." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("sign-in failed", error.status, error.code, error.message);
    return { error: signInMessage(error) };
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

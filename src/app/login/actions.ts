"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendResetLink } from "@/lib/data/members";
import { homeForUser } from "@/lib/auth";

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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("sign-in failed", error.status, error.code, error.message);
    return { error: signInMessage(error) };
  }
  // A temporary password: straight to choosing a permanent one.
  if (data.user?.app_metadata?.must_change_password) redirect("/set-password");
  // Straight to the right page (an action's redirect is an in-app navigation, so it
  // must land on a page, not on the /auth/continue route handler).
  const next = safeNext(form.get("next"));
  redirect(next && next !== "/login" ? next : await homeForUser(data.user.id, data.user.email ?? email));
}

export async function sendReset(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "המערכת עוד לא מחוברת למסד הנתונים." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "נא למלא אימייל." };
  // A Hebrew email with our own link (src/lib/data/members.ts).
  await sendResetLink(email).catch((e) => console.error("reset link", e));
  // Same answer whether or not the address exists.
  return { notice: "אם הכתובת רשומה במערכת, נשלח אליה קישור לבחירת סיסמה חדשה." };
}

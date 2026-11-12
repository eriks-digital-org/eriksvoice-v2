"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Saves the user's own password (after a temporary one, an invitation or a reset link)
 * and ends the "must change password" state, then refreshes the session so the new
 * token no longer carries it, and goes straight to the user's home (no extra hop
 * through /auth/continue, which raced the browser's own session refresh).
 */
export async function changePasswordAction(password: string): Promise<{ error?: string }> {
  if (password.length < 8) return { error: "הסיסמה צריכה להכיל לפחות 8 תווים." };
  if (password.length > 72) return { error: "הסיסמה ארוכה מדי." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "החיבור פג. נכנסים שוב עם הסיסמה הזמנית." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) console.error("set-password: update", error.status, error.code, error.message);
  if (error) {
    if (error.code === "same_password") return { error: "זו הסיסמה הנוכחית. בוחרים סיסמה אחרת." };
    if (error.code === "weak_password") return { error: "הסיסמה חלשה מדי. משלבים אותיות, ספרות וסימנים." };
    if (error.code === "reauthentication_needed") return { error: "צריך להיכנס מחדש עם הסיסמה הזמנית ואז לבחור סיסמה." };
    return { error: `השמירה נכשלה (${error.code ?? error.status}). נסו שוב.` };
  }
  if (data.user.app_metadata?.must_change_password) {
    await createAdminClient().auth.admin.updateUserById(data.user.id, { app_metadata: { must_change_password: false } });
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) console.error("set-password: refresh", refreshError.code, refreshError.message);
  }
  redirect(await homeForUser(data.user.id, data.user.email ?? ""));
}

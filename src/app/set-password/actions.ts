"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Saves the user's own password (after a temporary one, an invitation or a reset link)
 * and ends the "must change password" state, then refreshes the session so the new
 * token no longer carries it.
 */
export async function changePasswordAction(password: string): Promise<{ error?: string }> {
  if (password.length < 8) return { error: "הסיסמה צריכה להכיל לפחות 8 תווים." };
  if (password.length > 72) return { error: "הסיסמה ארוכה מדי." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "החיבור פג. נכנסים שוב עם הסיסמה הזמנית." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "זו הסיסמה הנוכחית. בוחרים סיסמה אחרת." };
    if (error.code === "weak_password") return { error: "הסיסמה חלשה מדי. משלבים אותיות, ספרות וסימנים." };
    return { error: "השמירה נכשלה. נסו שוב." };
  }
  if (data.user.app_metadata?.must_change_password) {
    await createAdminClient().auth.admin.updateUserById(data.user.id, { app_metadata: { must_change_password: false } });
    await supabase.auth.refreshSession();
  }
  return {};
}

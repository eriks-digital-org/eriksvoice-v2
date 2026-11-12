import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = { title: "בחירת סיסמה" };

export default async function SetPasswordPage() {
  // The session is read on the server (temporary password, or /auth/confirm from a reset link).
  const signedIn = isSupabaseConfigured ? Boolean((await (await createClient()).auth.getClaims()).data?.claims?.sub) : false;
  return (
    <AuthCard title="בחירת סיסמה קבועה" subtitle="במקום הסיסמה הזמנית. רק את/ה תדע/י אותה.">
      <SetPasswordForm signedIn={signedIn} />
    </AuthCard>
  );
}

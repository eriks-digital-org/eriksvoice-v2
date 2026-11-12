import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = { title: "בחירת סיסמה" };

export default function SetPasswordPage() {
  return (
    <AuthCard title="בחירת סיסמה קבועה" subtitle="במקום הסיסמה הזמנית. רק את/ה תדע/י אותה.">
      <SetPasswordForm />
    </AuthCard>
  );
}

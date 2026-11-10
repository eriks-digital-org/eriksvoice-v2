import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = { title: "בחירת סיסמה" };

export default function SetPasswordPage() {
  return (
    <AuthCard title="בחירת סיסמה" subtitle="עוד רגע הצוות שלך כאן.">
      <SetPasswordForm />
    </AuthCard>
  );
}

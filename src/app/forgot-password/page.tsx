import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "איפוס סיסמה" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="איפוס סיסמה" subtitle="נשלח לך קישור לבחירת סיסמה חדשה.">
      <ForgotForm />
    </AuthCard>
  );
}

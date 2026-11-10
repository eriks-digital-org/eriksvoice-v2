import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { getAccess, homeFor } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "כניסה" };

const errors: Record<string, string> = {
  "no-access": "החשבון שלך עוד לא משויך לעסק. פנו אלינו ונסדר את זה.",
  "link-expired": "הקישור כבר לא בתוקף. אפשר לבקש קישור חדש דרך \"שכחתי סיסמה\".",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "", error } = await searchParams;
  const access = await getAccess();
  if (access && !error) {
    const home = homeFor(access);
    if (home) redirect(next.startsWith("/") && !next.startsWith("//") ? next : home);
  }
  return (
    <AuthCard title="שמחים לראות אותך" subtitle="הצוות שלך כבר עונה לשיחות.">
      {!isSupabaseConfigured && (
        <p className="mb-5 rounded-[18px] bg-warning-soft p-3.5 text-[16px] text-warning">
          המערכת עוד לא מחוברת למסד הנתונים, ולכן אי אפשר להיכנס כרגע.
        </p>
      )}
      <LoginForm next={next} initialError={error ? (errors[error] ?? undefined) : undefined} />
    </AuthCard>
  );
}

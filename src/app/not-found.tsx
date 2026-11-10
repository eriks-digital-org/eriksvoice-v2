import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";

export default function NotFound() {
  return (
    <AuthCard title="הדף לא נמצא" subtitle="אולי הקישור השתנה, או שאין לך גישה לדף הזה.">
      <Link href="/login" className="flex min-h-12 items-center justify-center font-medium text-violet">
        לכניסה למערכת
      </Link>
    </AuthCard>
  );
}

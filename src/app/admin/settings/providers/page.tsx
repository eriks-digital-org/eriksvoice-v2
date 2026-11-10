import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ds/primitives";
import { requireAdmin } from "@/lib/auth";
import { PROVIDERS } from "@/lib/providers/registry";
import { describeSecrets } from "@/lib/providers/secrets";
import { ProviderCard } from "./ProviderCard";

export const metadata: Metadata = { title: "ספקים" };

export default async function ProvidersPage() {
  await requireAdmin();
  const info = await describeSecrets();
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="ספקים ומפתחות"
        description="המפתחות נשמרים מוצפנים בכספת של Supabase ולא מוצגים שוב, רק 4 התווים האחרונים. ערך שנשמר כאן גובר על הערך ב־Vercel, ונכנס לשימוש תוך חצי דקה."
        actions={
          <Link href="/admin/settings" className="min-h-11 rounded-full bg-card px-4 py-2.5 text-[15px] font-medium text-ink shadow-soft">
            חזרה להגדרות
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {PROVIDERS.map((p) => (
          <ProviderCard key={p.key} def={p} info={info} />
        ))}
      </div>
    </div>
  );
}

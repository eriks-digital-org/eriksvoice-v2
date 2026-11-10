import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { Pill } from "@/components/ds/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "./SettingsForm";
import Link from "next/link";
import { PROVIDERS } from "@/lib/providers/registry";
import { describeSecrets } from "@/lib/providers/secrets";

export const metadata: Metadata = { title: "הגדרות" };

export default async function SettingsPage() {
  await requireAdmin();
  const info = await describeSecrets();
  const { data } = await createAdminClient().from("system_settings").select("*").eq("id", true).maybeSingle();
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="הגדרות" description="כללים שמשותפים לכל המערכת." />
      <Panel
        title="ספקים ומפתחות"
        subtitle="ElevenLabs, Twilio, Utobo ו־Activepieces"
        action={
          <Link href="/admin/settings/providers" className="min-h-10 rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-white">
            ניהול
          </Link>
        }
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <li key={p.key} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4">
              <span className="text-[16px] text-ink">{p.name}</span>
              {p.fields.every((f) => f.optional || info[f.name]) ? <Pill tone="success">מוגדר</Pill> : <Pill tone="warning">חסר</Pill>}
            </li>
          ))}
        </ul>
      </Panel>
      <SettingsForm
        safety={data?.safety_rules ?? ""}
        emails={data?.alert_emails ?? []}
        hours={(data?.default_business_hours as { summary?: string } | null)?.summary ?? ""}
      />
    </div>
  );
}

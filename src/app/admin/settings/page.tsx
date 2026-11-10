import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { Pill } from "@/components/ds/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "הגדרות" };

/** Which provider keys are set in the server environment (values are never shown). */
const PROVIDERS = [
  { name: "ElevenLabs", env: "ELEVENLABS_API_KEY" },
  { name: "Twilio", env: "TWILIO_ACCOUNT_SID" },
  { name: "Utobo (מיילים)", env: "UTOBO_API_KEY" },
  { name: "Activepieces", env: "ACTIVEPIECES_URL" },
];

export default async function SettingsPage() {
  await requireAdmin();
  const { data } = await createAdminClient().from("system_settings").select("*").eq("id", true).maybeSingle();
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="הגדרות" description="כללים שמשותפים לכל המערכת." />
      <Panel title="ספקים" subtitle="המפתחות נשמרים בהגדרות השרת (Vercel), לא במסד הנתונים, ולא מוצגים כאן.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <li key={p.env} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4">
              <span className="text-[16px] text-ink">{p.name}</span>
              {process.env[p.env] ? <Pill tone="success">מוגדר</Pill> : <Pill tone="neutral">לא מוגדר</Pill>}
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

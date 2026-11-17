import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageHeader, Panel, StateBlock } from "@/components/ds/primitives";
import { Pill } from "@/components/ds/StatusBadge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { PROVIDERS } from "@/lib/providers/registry";
import { testProvider } from "@/lib/providers/test";
import { currentProblems } from "@/lib/health/checks";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncClient } from "@/lib/agents/sync";
import { routeClientNumbers } from "@/lib/agents/phones";

export const metadata: Metadata = { title: "תקינות מערכת" };

/** Sends every client with a failed agent or an unrouted number to the voice service again. */
async function retryAll() {
  "use server";
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: agents }, { data: numbers }] = await Promise.all([
    db.from("agents").select("client_id").eq("sync_status", "failed"),
    db.from("phone_numbers").select("client_id").not("route_error", "is", null),
  ]);
  for (const id of new Set((agents ?? []).map((a) => a.client_id as string))) await syncClient(id).catch(() => null);
  for (const id of new Set((numbers ?? []).map((n) => n.client_id as string))) await routeClientNumbers(id).catch(() => null);
  revalidatePath("/admin/health");
}

export default async function Page() {
  await requireAdmin();
  const [providers, { problems, overdueRuns }] = await Promise.all([
    Promise.all(PROVIDERS.map(async (p) => ({ p, r: await testProvider(p.key).catch(() => ({ ok: false, message: "הבדיקה נכשלה" })) }))),
    currentProblems(),
  ]);
  const retryable = problems.some((x) => x.what.startsWith("הסנכרון") || x.what.startsWith("המספר"));

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="תקינות מערכת" description="מצב הספקים ותקלות פתוחות לפי לקוח. התראות על חריגות נשלחות כל בוקר ב־08:00." />

      <Panel title="ספקים" subtitle="בדיקה חיה של המפתחות השמורים">
        <ul className="grid gap-3 sm:grid-cols-2">
          {providers.map(({ p, r }) => (
            <li key={p.key} className="flex items-start justify-between gap-3 rounded-[18px] bg-muted/60 p-4">
              <div className="min-w-0">
                <p className="text-[17px] font-medium text-ink">{p.name}</p>
                <p className="mt-1 text-[14px] text-ink-muted">{r.message}</p>
              </div>
              <Pill tone={r.ok ? "success" : "danger"}>{r.ok ? "תקין" : "תקלה"}</Pill>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="המתזמן" subtitle="רץ כל דקה: תותח שיחות, אוטומציות וחזרות">
        {overdueRuns > 0 ? (
          <p className="text-[16px] text-destructive">
            {overdueRuns} ריצות אוטומציה מחכות יותר מרבע שעה. כנראה שהמתזמן (pg_cron) לא קורא לשרת. בודקים ב־Supabase ← Cron.
          </p>
        ) : (
          <p className="text-[16px] text-ink-muted">אין ריצות שמחכות יותר מדי. המתזמן עובד.</p>
        )}
      </Panel>

      <Panel
        title={`תקלות פתוחות (${problems.length})`}
        action={
          retryable ? (
            <form action={retryAll}>
              <Button type="submit" variant="outline" size="sm">
                ניסיון חוזר לכל הסנכרונים
              </Button>
            </form>
          ) : undefined
        }
        bodyClassName={problems.length ? "p-0 sm:p-0" : undefined}
      >
        {problems.length === 0 ? (
          <StateBlock kind="success" title="הכול תקין" description="אין סוכנים שנכשלו, מספרים לא מנותבים, חיבורים מנותקים או אוטומציות שנכשלו השבוע." />
        ) : (
          <ul className="divide-y divide-border">
            {problems.map((x, i) => (
              <li key={i} className="px-[22px] py-4 sm:px-8">
                <Link href={x.link} className="block">
                  <p className="text-[16px] font-medium text-ink">
                    {x.clientName} · {x.what}
                  </p>
                  {x.detail && <p className="mt-1 text-[14px] text-ink-muted" dir="auto">{x.detail}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

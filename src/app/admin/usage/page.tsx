import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel, StateBlock } from "@/components/ds/primitives";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { minutesThisMonth } from "@/lib/calls/ingest";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "שימוש" };

export default async function Page() {
  await requireAdmin();
  const [{ data: clients }, usage] = await Promise.all([
    createAdminClient().from("clients").select("id, name, monthly_minutes").order("name"),
    minutesThisMonth(),
  ]);
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="שימוש" description="דקות החודש (שעון ישראל) מול המכסה של כל לקוח. ב־80% נשלחת התראה ללקוח ולך." />
      <Panel bodyClassName="p-0 sm:p-0">
        {(clients ?? []).length === 0 ? (
          <StateBlock kind="empty" title="עוד אין לקוחות" />
        ) : (
          <ul className="divide-y divide-border">
            {(clients ?? []).map((c) => {
              const u = usage.get(c.id) ?? { minutes: 0, calls: 0 };
              const pct = c.monthly_minutes ? Math.min(100, Math.round((u.minutes / c.monthly_minutes) * 100)) : 0;
              return (
                <li key={c.id}>
                  <Link href={`/admin/clients/${c.id}`} className="flex min-h-[72px] flex-col justify-center gap-2 px-[22px] py-3 hover:bg-tint/60 sm:px-8">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-[17px] font-medium text-ink">{c.name}</span>
                      <span className="num text-[14px] text-ink-muted">
                        {u.minutes} / {c.monthly_minutes || "∞"} דק׳ · {u.calls} שיחות
                      </span>
                    </span>
                    {c.monthly_minutes > 0 && (
                      <span className="h-2 overflow-hidden rounded-full bg-muted">
                        <span className={cn("block h-full rounded-full", pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

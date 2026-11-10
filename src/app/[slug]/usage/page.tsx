import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { StatTile } from "@/components/ds/kit";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { monthKey } from "@/lib/calls/ingest";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "דקות וחשבון" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { client } = await requireMember((await params).slug);
  const db = await createClient();
  const [{ data: row }, { data: usage }] = await Promise.all([
    db.from("clients").select("monthly_minutes").eq("id", client.id).single(),
    db.from("client_month_usage").select("minutes, calls").eq("client_id", client.id).eq("month", `${monthKey()}T00:00:00`).maybeSingle(),
  ]);
  const quota = row?.monthly_minutes ?? 0;
  const used = usage?.minutes ?? 0;
  const pct = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="דקות וחשבון" description="השימוש החודש מול המכסה." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="דקות החודש" value={used} />
        <StatTile label="מכסה חודשית" value={quota || "ללא הגבלה"} />
        <StatTile label="שיחות החודש" value={usage?.calls ?? 0} />
      </div>
      {quota > 0 && (
        <Panel title={`נוצלו ${pct}%`}>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
          </div>
        </Panel>
      )}
    </div>
  );
}

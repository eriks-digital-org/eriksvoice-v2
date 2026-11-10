import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { PageHeader, Panel, StateBlock } from "@/components/ds/primitives";
import { StatTile } from "@/components/ds/kit";
import { ClientStatusBadge } from "@/components/ds/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClientRow } from "@/lib/data/types";

export default async function AdminHome() {
  const access = await requireAdmin();
  const db = createAdminClient();
  const [{ data: clients }, { count: activeAgents }, { count: allAgents }] = await Promise.all([
    db.from("clients").select("id, slug, name, status, monthly_minutes").order("created_at", { ascending: false }).limit(6),
    db.from("agents").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("agents").select("id", { count: "exact", head: true }),
  ]);
  const { count: clientCount } = await db.from("clients").select("id", { count: "exact", head: true });
  const first = access.fullName.split(" ")[0];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title={`שלום ${first},`} soft="הכל במקום אחד." description="הלקוחות, הסוכנים והשיחות של כל המערכת." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="לקוחות" value={clientCount ?? 0} />
        <StatTile label="סוכנים פעילים" value={activeAgents ?? 0} hint={`מתוך ${allAgents ?? 0}`} />
        <StatTile label="שיחות היום" value={0} hint="יתמלא עם חיבור הטלפוניה" />
        <StatTile label="דקות החודש" value={0} />
      </div>
      <Panel
        title="לקוחות אחרונים"
        action={
          <Link href="/admin/clients/new" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-[15px] font-medium text-white">
            <Plus className="size-4" /> לקוח חדש
          </Link>
        }
      >
        {(clients ?? []).length === 0 ? (
          <StateBlock kind="empty" title="עוד אין לקוחות" description="פותחים לקוח באשף של שלושה צעדים, והסוכנים שלו נוצרים כבויים." />
        ) : (
          <ul className="divide-y divide-border">
            {(clients as Pick<ClientRow, "id" | "slug" | "name" | "status" | "monthly_minutes">[]).map((c) => (
              <li key={c.id}>
                <Link href={`/admin/clients/${c.id}`} className="flex min-h-16 items-center gap-4 py-2 hover:text-violet">
                  <span className="grid size-11 place-items-center rounded-full bg-tint text-violet">
                    <Building2 className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-medium text-ink">{c.name}</span>
                    <span className="num block text-[13px] text-ink-muted">/{c.slug}</span>
                  </span>
                  <ClientStatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

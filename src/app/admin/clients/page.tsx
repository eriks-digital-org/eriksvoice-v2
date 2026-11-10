import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { PageHeader, Panel, StateBlock } from "@/components/ds/primitives";
import { ClientStatusBadge } from "@/components/ds/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClientRow } from "@/lib/data/types";

export const metadata: Metadata = { title: "לקוחות" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const db = createAdminClient();
  let query = db.from("clients").select("id, slug, name, status, industry, monthly_minutes, agents(id, status)").order("name");
  if (q.trim()) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,slug.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data } = await query;
  type Row = Pick<ClientRow, "id" | "slug" | "name" | "status" | "industry" | "monthly_minutes"> & {
    agents: { id: string; status: string }[];
  };
  const clients = (data ?? []) as Row[];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="לקוחות"
        description="כל העסקים במערכת. פותחים לקוח חדש באשף, ומנהלים כל אחד מהמסך שלו."
        actions={
          <Link href="/admin/clients/new" className="cta-pill group">
            לקוח חדש
            <span className="cta-dot group-hover:-rotate-90">
              <Plus className="size-[22px]" strokeWidth={2.2} />
            </span>
          </Link>
        }
      />
      <form className="max-w-md">
        <label className="relative block">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="חיפוש לפי שם או כתובת"
            className="h-12 w-full rounded-2xl border-2 border-transparent bg-card px-4 text-[16px] text-ink shadow-soft outline-none placeholder:text-ink-soft focus:border-[#cbbcf8]"
          />
        </label>
      </form>
      <Panel bodyClassName="p-0 sm:p-0">
        {clients.length === 0 ? (
          <StateBlock kind="empty" title={q ? "לא נמצאו לקוחות" : "עוד אין לקוחות"} />
        ) : (
          <ul className="divide-y divide-border">
            {clients.map((c) => {
              const active = c.agents.filter((a) => a.status === "active").length;
              return (
                <li key={c.id}>
                  <Link href={`/admin/clients/${c.id}`} className="flex min-h-[76px] items-center gap-4 px-[22px] py-3 transition-colors hover:bg-tint/60 sm:px-8">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#d9cbff,#c7f0e6)] text-ink">
                      <Building2 className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[18px] font-medium text-ink">{c.name}</span>
                      <span className="block truncate text-[14px] text-ink-muted">
                        {c.industry || "—"} · <span className="num">/{c.slug}</span>
                      </span>
                    </span>
                    <span className="hidden text-[14px] text-ink-muted sm:block">
                      <span className="num">{active}</span> מתוך <span className="num">{c.agents.length}</span> סוכנים פעילים
                    </span>
                    <ClientStatusBadge status={c.status} />
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

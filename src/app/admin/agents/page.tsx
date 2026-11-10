import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ds/primitives";
import { Pill } from "@/components/ds/StatusBadge";
import { characterForType } from "@/components/agents/characters";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentTypeRow } from "@/lib/data/types";

export const metadata: Metadata = { title: "סוכני AI" };

export default async function AgentTypesPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: types }, { data: agents }] = await Promise.all([
    db.from("agent_types").select("*").order("sort"),
    db.from("agents").select("type_key, status"),
  ]);
  const count = (key: string, status?: string) =>
    (agents ?? []).filter((a) => a.type_key === key && (!status || a.status === status)).length;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="סוכני AI"
        soft="חמשת הסוגים."
        description="כל סוג מוגדר פעם אחת: פרומפט, מודל, קול והגדרות דיבור. שמירה עולה מיד לכל הסוכנים מאותו סוג אצל כל הלקוחות."
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {((types ?? []) as AgentTypeRow[]).map((t) => {
          const c = characterForType(t.key, t.key);
          return (
            <li key={t.key}>
              <Link href={`/admin/agents/${t.key}`} className="surface lift flex h-full flex-col gap-4 p-6">
                <div className="flex items-center gap-4">
                  <span className="grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: c.wash }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.smile} alt="" className="size-[72px] object-contain" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[21px] font-medium text-ink">{t.name}</h2>
                    <p className="text-[15px] text-ink-muted">{t.purpose}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  {t.prompt.trim() ? <Pill tone="success">יש פרומפט</Pill> : <Pill tone="warning">פרומפט ריק</Pill>}
                  <Pill tone="neutral" dot={false}>
                    <span className="num">{count(t.key)}</span>&nbsp;סוכנים · <span className="num">{count(t.key, "active")}</span>&nbsp;פעילים
                  </Pill>
                  <ChevronLeft className="ms-auto size-5 text-ink-soft" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

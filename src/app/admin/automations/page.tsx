import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, Panel, StateBlock } from "@/components/ds/primitives";
import { Pill } from "@/components/ds/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORIES, describe, type AutomationSpec } from "@/lib/automations/catalog";
import { templateRowAction } from "./actions";

export const metadata: Metadata = { title: "תבניות אוטומציה" };

type Row = { id: string; name: string; title: string; category: string; hidden: boolean; version: number; spec: AutomationSpec };

export default async function Page() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data }, { data: uses }] = await Promise.all([
    db.from("automation_templates").select("id, name, title, category, hidden, version, spec").order("sort").order("created_at"),
    db.from("automations").select("template_id").not("template_id", "is", null),
  ]);
  const list = (data ?? []) as Row[];
  const count = new Map<string, number>();
  for (const u of (uses ?? []) as { template_id: string }[]) count.set(u.template_id, (count.get(u.template_id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="תבניות אוטומציה"
        description="תבניות שכל הלקוחות רואים ומתחילים מהן. כל לקוח בוחר סוכן משלו, ועדכון לתבנית מוצע להם ולא מוחל לבד."
        actions={
          <Link href="/admin/automations/new" className="cta-pill group">
            תבנית חדשה
            <span className="cta-dot group-hover:-rotate-90">
              <Plus className="size-[22px]" strokeWidth={2.2} />
            </span>
          </Link>
        }
      />
      <Panel bodyClassName="p-0 sm:p-0">
        {list.length === 0 ? (
          <StateBlock kind="empty" title="עוד אין תבניות" description="תבנית חדשה מופיעה מיד בגלריה של כל הלקוחות." />
        ) : (
          <ul className="divide-y divide-border">
            {list.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-[22px] py-4 sm:px-8">
                <Link href={`/admin/automations/${t.id}`} className="min-w-0 flex-1">
                  <span className="block text-[17px] font-medium text-ink">{t.title || t.name}</span>
                  <span className="block text-[14px] text-ink-muted">{describe(t.spec)}</span>
                  <span className="mt-1 block text-[13px] text-ink-soft">
                    {CATEGORIES.find((c) => c.key === t.category)?.label ?? t.category} · גרסה {t.version} · בשימוש אצל {count.get(t.id) ?? 0}
                  </span>
                </Link>
                <form action={templateRowAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <button name="op" value={t.hidden ? "show" : "hide"} className="min-h-10">
                    {t.hidden ? <Pill tone="neutral">מוסתרת</Pill> : <Pill tone="success">מוצגת</Pill>}
                  </button>
                  <button name="op" value="delete" className="min-h-10 rounded-full px-3 text-[13px] font-medium text-destructive hover:bg-destructive-soft">
                    מחיקה
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

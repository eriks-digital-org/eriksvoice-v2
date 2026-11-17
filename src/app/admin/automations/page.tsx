import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, Panel, StateBlock } from "@/components/ds/primitives";
import { Pill } from "@/components/ds/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORIES, describe, type AutomationSpec } from "@/lib/automations/catalog";
import { markBuiltAction, templateRowAction } from "./actions";

export const metadata: Metadata = { title: "תבניות אוטומציה" };

type Build = { id: string; name: string; spec: AutomationSpec; build_requested_at: string | null; clients: { id: string; name: string } | null };

type Row = { id: string; name: string; title: string; category: string; hidden: boolean; version: number; spec: AutomationSpec };

export default async function Page() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data }, { data: uses }, { data: pending }] = await Promise.all([
    db.from("automation_templates").select("id, name, title, category, hidden, version, spec").order("sort").order("created_at"),
    db.from("automations").select("template_id").not("template_id", "is", null),
    db.from("automations").select("id, name, spec, build_requested_at, clients(id, name)").eq("build_status", "pending").order("build_requested_at"),
  ]);
  const builds = (pending ?? []) as unknown as Build[];
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
      {builds.length > 0 && (
        <div id="builds">
          <Panel title="מחכות לבנייה ב־Activepieces" subtitle="לקוחות בחרו אוטומציות שפועלות בחשבון שלהם. בונים את ה־flow של הלקוח ומסמנים ״נבנתה״: היא מתחילה לפעול והלקוח מקבל התראה ומייל.">
            <ul className="divide-y divide-border">
              {builds.map((b) => (
                <li key={b.id} className="flex flex-wrap items-start gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <Link href={b.clients ? `/admin/clients/${b.clients.id}` : "#"} className="block text-[17px] font-medium text-ink">
                      {b.clients?.name ?? "לקוח"} · {b.name}
                    </Link>
                    <span className="block text-[14px] text-ink-muted">{describe(b.spec)}</span>
                    {b.spec.actions
                      .filter((x) => x.type === "activepieces")
                      .map((x, i) => (
                        <span key={i} dir="ltr" className="mt-1 block text-start font-mono text-[13px] text-ink-soft">
                          {x.config.action}
                          {x.config.params ? ` · ${x.config.params.replace(/\n/g, " · ")}` : ""}
                        </span>
                      ))}
                    {b.build_requested_at && (
                      <span className="mt-1 block text-[13px] text-ink-soft">
                        התבקשה {new Date(b.build_requested_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <form action={markBuiltAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-white">נבנתה</button>
                  </form>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
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

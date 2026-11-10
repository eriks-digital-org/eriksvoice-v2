import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, Panel, StateBlock } from "@/components/ds/primitives";
import { Pill } from "@/components/ds/StatusBadge";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describe, type AutomationSpec } from "@/lib/automations/catalog";
import { automationRowAction } from "./actions";

export const metadata: Metadata = { title: "אוטומציות" };

type Row = { id: string; name: string; enabled: boolean; spec: AutomationSpec; template_id: string | null; template_version: number | null; last_run_at: string | null };
type Template = { id: string; name: string; title: string; saves: string; category: string; version: number };
type Run = { id: string; automation_id: string; status: string; created_at: string; last_error: string | null; log: { action: string; ok: boolean; message: string }[] };

const RUN: Record<string, { label: string; tone: "success" | "danger" | "info" | "neutral" | "warning" }> = {
  queued: { label: "ממתין", tone: "info" },
  running: { label: "רץ", tone: "info" },
  done: { label: "בוצע", tone: "success" },
  failed: { label: "נכשל", tone: "danger" },
  skipped: { label: "דולג", tone: "neutral" },
};
const when = (iso: string) => new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { client } = await requireMember(slug);
  const db = await createClient();
  const [{ data: autos }, { data: templates }, { data: runs }, { data: c }] = await Promise.all([
    db.from("automations").select("id, name, enabled, spec, template_id, template_version, last_run_at").eq("client_id", client.id).order("created_at"),
    db.from("automation_templates").select("id, name, title, saves, category, version").order("sort"),
    db.from("automation_runs").select("id, automation_id, status, created_at, last_error, log").eq("client_id", client.id).order("created_at", { ascending: false }).limit(20),
    db.from("clients").select("inbound_token").eq("id", client.id).single(),
  ]);
  const list = (autos ?? []) as Row[];
  const tpl = (templates ?? []) as Template[];
  const names = new Map(list.map((a) => [a.id, a.name]));
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://eriksvoice.co.il";

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="אוטומציות"
        description="מה קורה אוטומטית אצלכם: כאשר משהו קורה, הסוכנים והמערכת עושים את מה שהגדרתם."
        actions={
          <Link href={`/${slug}/automations/new`} className="cta-pill group">
            אוטומציה חדשה
            <span className="cta-dot group-hover:-rotate-90">
              <Plus className="size-[22px]" strokeWidth={2.2} />
            </span>
          </Link>
        }
      />

      <Panel title="האוטומציות שלי" bodyClassName="p-0 sm:p-0">
        {list.length === 0 ? (
          <StateBlock kind="empty" title="עוד אין אוטומציות" description="מתחילים מתבנית למטה, או בונים אחת מאפס." />
        ) : (
          <ul className="divide-y divide-border">
            {list.map((a) => {
              const t = tpl.find((x) => x.id === a.template_id);
              const update = t && a.template_version && t.version > a.template_version;
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-[22px] py-4 sm:px-8">
                  <Link href={`/${slug}/automations/${a.id}`} className="min-w-0 flex-1">
                    <span className="block text-[17px] font-medium text-ink">{a.name}</span>
                    <span className="block text-[14px] text-ink-muted">{describe(a.spec)}</span>
                    {update && <span className="mt-1 block text-[13px] text-violet">יש עדכון לתבנית. פותחים כדי לראות ולהחיל.</span>}
                  </Link>
                  <form action={automationRowAction} className="flex items-center gap-2">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={a.id} />
                    <button name="op" value={a.enabled ? "off" : "on"} className="min-h-10">
                      {a.enabled ? <Pill tone="success">פעילה</Pill> : <Pill tone="neutral">מושהית</Pill>}
                    </button>
                    <button name="op" value="delete" className="min-h-10 rounded-full px-3 text-[13px] font-medium text-destructive hover:bg-destructive-soft">
                      מחיקה
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {tpl.length > 0 && (
        <Panel title="תבניות מוכנות" subtitle="בוחרים, מתאימים ושומרים.">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tpl.map((t) => (
              <li key={t.id}>
                <Link href={`/${slug}/automations/new?template=${t.id}`} className="flex h-full flex-col gap-2 rounded-3xl bg-tint/60 p-5 transition-colors hover:bg-tint">
                  <span className="text-[16px] font-medium text-ink">{t.title || t.name}</span>
                  {t.saves && <span className="text-[14px] text-ink-muted">{t.saves}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="יומן ריצות" bodyClassName="p-0 sm:p-0">
        {(runs ?? []).length === 0 ? (
          <p className="px-[22px] pb-6 text-[15px] text-ink-muted sm:px-8">עוד לא רצה אף אוטומציה.</p>
        ) : (
          <ul className="divide-y divide-border">
            {((runs ?? []) as Run[]).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-[22px] py-3 sm:px-8">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-ink">{names.get(r.automation_id) ?? "אוטומציה שנמחקה"}</span>
                  <span className="block text-[13px] text-ink-muted">
                    {r.log.map((l) => `${l.ok ? "✓" : "✗"} ${l.message}`).join(" · ") || r.last_error || ""}
                  </span>
                </span>
                <span className="num text-[13px] text-ink-muted">{when(r.created_at)}</span>
                <Pill tone={RUN[r.status]?.tone ?? "neutral"}>{RUN[r.status]?.label ?? r.status}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="כתובת Webhook לקבלת נתונים" subtitle="שולחים לכאן טופס מהאתר או נתונים ממערכת אחרת (POST, JSON או טופס). שדה phone יוצר ליד, ושדה event נותן שם לאירוע.">
        <code dir="ltr" className="block break-all rounded-2xl bg-muted/60 p-3 text-[14px] text-ink">
          {site}/api/public/hooks/{c?.inbound_token}
        </code>
      </Panel>
    </div>
  );
}

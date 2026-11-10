import Link from "next/link";
import { AlertTriangle, Building2, PhoneOutgoing, Plus, Settings2 } from "lucide-react";
import { PageHeader, Panel, StateBlock } from "@/components/ds/primitives";
import { StatTile } from "@/components/ds/kit";
import { ClientStatusBadge } from "@/components/ds/StatusBadge";
import { CallList } from "@/components/calls/CallList";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCalls } from "@/lib/calls/queries";
import { refreshLiveCalls } from "@/lib/calls/live";
import { monthKey } from "@/lib/calls/ingest";
import { CONNECTIONS } from "@/lib/connections";
import type { ClientRow } from "@/lib/data/types";
import { DEFAULT_WIDGETS, WIDGETS, type WidgetKey } from "./home-widgets";
import { saveWidgetsAction } from "./actions";

/** Midnight today, Israel time. */
function israelDayStart(): Date {
  const now = new Date();
  const ymd = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const offset =
    new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - offset);
}

type Db = ReturnType<typeof createAdminClient>;

async function Stats({ db }: { db: Db }) {
  const today = israelDayStart().toISOString();
  const [{ count: clients }, { count: active }, { count: all }, { count: callsToday }, { count: failedToday }, { data: usage }] = await Promise.all([
    db.from("clients").select("id", { count: "exact", head: true }),
    db.from("agents").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("agents").select("id", { count: "exact", head: true }),
    db.from("calls").select("id", { count: "exact", head: true }).gte("started_at", today).not("status", "in", "(failed,no_answer)"),
    db.from("calls").select("id", { count: "exact", head: true }).gte("started_at", today).in("status", ["failed", "no_answer"]),
    db.from("client_month_usage").select("minutes").eq("month", `${monthKey()}T00:00:00`),
  ]);
  const minutes = (usage ?? []).reduce((s, u) => s + ((u.minutes as number) ?? 0), 0);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="לקוחות" value={clients ?? 0} />
      <StatTile label="סוכנים פעילים" value={active ?? 0} hint={`מתוך ${all ?? 0}`} />
      <StatTile label="שיחות היום" value={callsToday ?? 0} hint={failedToday ? `ועוד ${failedToday} שלא נענו או נכשלו` : undefined} />
      <StatTile label="דקות החודש" value={minutes} />
    </div>
  );
}

async function Live({ db }: { db: Db }) {
  const live = await refreshLiveCalls().catch(() => 0);
  const { data } = live
    ? await db.from("calls").select("id, external_number, status, clients(name), agents(name)").in("status", ["calling", "ringing", "in_progress"]).order("started_at", { ascending: false }).limit(10)
    : { data: [] };
  type Row = { id: string; external_number: string; status: string; clients: { name: string } | null; agents: { name: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <Panel title="שיחות פתוחות עכשיו" action={<Link href="/admin/calls" className="text-[15px] font-medium text-violet">לכל השיחות</Link>}>
      {rows.length === 0 ? (
        <p className="text-[15px] text-ink-muted">אין כרגע שיחות פתוחות.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex min-h-12 items-center gap-3">
              <PhoneOutgoing className="size-4 text-violet" />
              <span dir="ltr" className="num text-[15px] text-ink">{r.external_number}</span>
              <span className="truncate text-[14px] text-ink-muted">{[r.clients?.name, r.agents?.name].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

async function Attention({ db }: { db: Db }) {
  const [{ data: requests }, { data: broken }, { data: usage }, { data: clients }] = await Promise.all([
    db.from("connections").select("client_id, kind, requested_at").eq("status", "requested").order("requested_at"),
    db.from("agents").select("client_id, name, sync_error").eq("sync_status", "failed").neq("status", "draft"),
    db.from("client_month_usage").select("client_id, minutes").eq("month", `${monthKey()}T00:00:00`),
    db.from("clients").select("id, name, monthly_minutes"),
  ]);
  const nameOf = (id: string) => (clients ?? []).find((c) => c.id === id)?.name ?? "";
  const quota = (usage ?? [])
    .map((u) => {
      const c = (clients ?? []).find((x) => x.id === u.client_id);
      const limit = (c?.monthly_minutes as number) ?? 0;
      return { id: u.client_id as string, pct: limit ? Math.round(((u.minutes as number) / limit) * 100) : 0 };
    })
    .filter((q) => q.pct >= 80);
  const items = [
    ...(requests ?? []).map((r) => ({ href: `/admin/clients/${r.client_id}`, text: `${nameOf(r.client_id as string)}: בקשת חיבור ${CONNECTIONS.find((c) => c.kind === r.kind)?.label ?? r.kind}` })),
    ...(broken ?? []).map((a) => ({ href: `/admin/clients/${a.client_id}`, text: `${nameOf(a.client_id as string)}: הסוכן ${a.name} לא מסונכרן (${a.sync_error ?? "שגיאה"})` })),
    ...quota.map((q) => ({ href: `/admin/clients/${q.id}`, text: `${nameOf(q.id)}: ${q.pct}% מדקות החודש` })),
  ];
  return (
    <Panel title="דורש טיפול">
      {items.length === 0 ? (
        <p className="text-[15px] text-ink-muted">הכל תקין.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i, n) => (
            <li key={n}>
              <Link href={i.href} className="flex min-h-12 items-center gap-3 text-[15px] text-ink hover:text-violet">
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                <span className="min-w-0 flex-1">{i.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

async function Contacts({ db }: { db: Db }) {
  const { data } = await db.from("notifications").select("id, title, body, created_at, read_at").eq("kind", "contact").order("created_at", { ascending: false }).limit(5);
  return (
    <Panel title="פניות מהאתר" action={<Link href="/admin/notifications" className="text-[15px] font-medium text-violet">לכל ההתראות</Link>}>
      {(data ?? []).length === 0 ? (
        <p className="text-[15px] text-ink-muted">עוד אין פניות מהטופס בדף הבית.</p>
      ) : (
        <ul className="divide-y divide-border">
          {(data ?? []).map((n) => (
            <li key={n.id as string} className="py-3">
              <span className={`block text-[16px] ${n.read_at ? "text-ink-muted" : "font-medium text-ink"}`}>{(n.title as string).replace("פנייה חדשה מהאתר: ", "")}</span>
              <span className="block whitespace-pre-line text-[14px] text-ink-muted">{n.body as string}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

async function Calls({ db }: { db: Db }) {
  const calls = await listCalls(db, { page: 1, withClient: true });
  return (
    <Panel title="שיחות אחרונות" bodyClassName="p-0 sm:p-0" action={<Link href="/admin/calls" className="text-[15px] font-medium text-violet">לכל השיחות</Link>}>
      <CallList calls={calls.slice(0, 6)} page={1} hrefFor={(id) => `/admin/calls/${id}`} pageHref={() => "/admin/calls"} emptyText="שיחות יופיעו כאן כשהסוכנים יתחילו לדבר." />
    </Panel>
  );
}

async function Clients({ db }: { db: Db }) {
  const { data: clients } = await db.from("clients").select("id, slug, name, status, monthly_minutes").order("created_at", { ascending: false }).limit(6);
  return (
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
  );
}

const RENDER: Record<WidgetKey, (p: { db: Db }) => Promise<React.ReactNode>> = {
  stats: Stats,
  live: Live,
  attention: Attention,
  contacts: Contacts,
  calls: Calls,
  clients: Clients,
};

export default async function AdminHome() {
  const access = await requireAdmin();
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("home_widgets").eq("id", access.userId).maybeSingle();
  const chosen = ((profile?.home_widgets as string[] | null) ?? DEFAULT_WIDGETS).filter((k): k is WidgetKey => k in RENDER);
  const first = access.fullName.split(" ")[0];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title={`שלום ${first},`} soft="הכל במקום אחד." description="הלקוחות, הסוכנים והשיחות של כל המערכת." />
      {chosen.map((k) => {
        const W = RENDER[k];
        return <W key={k} db={db} />;
      })}
      <details className="surface p-5 sm:p-6">
        <summary className="flex cursor-pointer items-center gap-2 text-[15px] font-medium text-ink">
          <Settings2 className="size-4" /> התאמת המסך
        </summary>
        <form action={saveWidgetsAction} className="mt-4 flex flex-col gap-3">
          {WIDGETS.map((w) => {
            const pos = chosen.indexOf(w.key);
            return (
              <label key={w.key} className="flex min-h-11 items-center gap-3 text-[15px] text-ink">
                <input type="checkbox" name={`on_${w.key}`} defaultChecked={pos >= 0} className="size-5" />
                <input type="number" name={`pos_${w.key}`} min={1} max={20} defaultValue={pos >= 0 ? pos + 1 : WIDGETS.length} aria-label="מיקום" className="h-10 w-16 rounded-xl border border-input bg-card px-2 text-center" />
                {w.label}
              </label>
            );
          })}
          <p className="text-[13px] text-ink-muted">מסמנים מה להציג. המספר קובע את הסדר, ו־1 מופיע ראשון.</p>
          <button className="min-h-11 self-start rounded-full bg-ink px-5 text-[15px] font-medium text-white">שמירה</button>
        </form>
      </details>
    </div>
  );
}

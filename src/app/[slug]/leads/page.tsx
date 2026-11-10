import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel, StateBlock } from "@/components/ds/primitives";
import { Pill, type Tone } from "@/components/ds/StatusBadge";
import { StatTile } from "@/components/ds/kit";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { leadAction } from "./actions";
import { AddLeadForm, DialerForm, ImportForm, type DialerView } from "./LeadForms";

export const metadata: Metadata = { title: "רשימת חיוג" };

const STATUS: Record<string, { label: string; tone: Tone }> = {
  new: { label: "חדש", tone: "neutral" },
  queued: { label: "בתור", tone: "info" },
  calling: { label: "בשיחה", tone: "lime" },
  done: { label: "שוחח", tone: "success" },
  failed: { label: "לא ענה", tone: "warning" },
  dnc: { label: "לא להתקשר", tone: "danger" },
};
const PAGE = 50;

type Lead = { id: string; name: string; phone: string; tags: string[]; status: string; attempts: number; last_result: string; last_called_at: string | null };

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ status?: string; tag?: string; page?: string }> }) {
  const { slug } = await params;
  const { client } = await requireMember(slug);
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const db = await createClient();

  let q = db
    .from("leads")
    .select("id, name, phone, tags, status, attempts, last_result, last_called_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.status && STATUS[sp.status]) q = q.eq("status", sp.status);
  if (sp.tag) q = q.contains("tags", [sp.tag]);

  const [{ data: leads }, { data: all }, { data: settings }, { data: agents }] = await Promise.all([
    q,
    db.from("leads").select("status, tags").eq("client_id", client.id).limit(10000),
    db.from("dialer_settings").select("*").eq("client_id", client.id).maybeSingle(),
    db.from("agents").select("id, name").eq("client_id", client.id).eq("status", "active").order("created_at"),
  ]);
  const list = (leads ?? []) as Lead[];
  const counts = new Map<string, number>();
  const tags = new Set<string>();
  for (const l of all ?? []) {
    counts.set(l.status, (counts.get(l.status) ?? 0) + 1);
    for (const t of l.tags as string[]) tags.add(t);
  }
  const dialer: DialerView = (settings as DialerView | null) ?? {
    enabled: false,
    agent_id: null,
    tag: "",
    start_minute: 540,
    end_minute: 1140,
    days: [0, 1, 2, 3, 4],
    max_attempts: 3,
    retry_minutes: 120,
    concurrency: 3,
  };
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status: sp.status, tag: sp.tag, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/${slug}/leads${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="רשימת חיוג" description="לידים שהסוכן מתקשר אליהם. מכניסים לתור, והתותח מחייג לבד בשעות שבחרתם." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="בתור" value={counts.get("queued") ?? 0} />
        <StatTile label="בשיחה עכשיו" value={counts.get("calling") ?? 0} />
        <StatTile label="שוחחו" value={counts.get("done") ?? 0} />
        <StatTile label="לא ענו" value={counts.get("failed") ?? 0} />
      </div>

      <Panel title="תותח שיחות">
        <DialerForm slug={slug} settings={dialer} agents={agents ?? []} tags={[...tags].sort()} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="הוספת ליד">
          <AddLeadForm slug={slug} />
        </Panel>
        <Panel title="ייבוא מקובץ">
          <ImportForm slug={slug} />
        </Panel>
      </div>

      <Panel
        title="לידים"
        action={
          (counts.get("new") ?? 0) > 0 ? (
            <form action={leadAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="op" value="queue-all" />
              <input type="hidden" name="tag" value={sp.tag ?? ""} />
              <button className="min-h-10 rounded-full bg-ink px-4 text-[14px] font-medium text-white">
                הכנסת כל החדשים{sp.tag ? ` בתיקייה ${sp.tag}` : ""} לתור
              </button>
            </form>
          ) : undefined
        }
        bodyClassName="p-0 sm:p-0"
      >
        <div className="flex flex-wrap gap-2 px-[22px] pb-3 sm:px-8">
          <Link href={href({ status: undefined, page: undefined })} className={`rounded-full px-3 py-1.5 text-[14px] ${!sp.status ? "bg-ink text-white" : "bg-muted/60 text-ink"}`}>
            הכל
          </Link>
          {Object.entries(STATUS).map(([k, v]) => (
            <Link key={k} href={href({ status: k, page: undefined })} className={`rounded-full px-3 py-1.5 text-[14px] ${sp.status === k ? "bg-ink text-white" : "bg-muted/60 text-ink"}`}>
              {v.label} <span className="num">{counts.get(k) ?? 0}</span>
            </Link>
          ))}
          {[...tags].sort().map((t) => (
            <Link key={t} href={href({ tag: sp.tag === t ? undefined : t, page: undefined })} className={`rounded-full px-3 py-1.5 text-[14px] ${sp.tag === t ? "bg-violet text-white" : "bg-tint text-ink"}`}>
              📁 {t}
            </Link>
          ))}
        </div>
        {list.length === 0 ? (
          <StateBlock kind="empty" title="אין לידים" description="מוסיפים ליד ידנית או מייבאים קובץ." />
        ) : (
          <ul className="divide-y divide-border">
            {list.map((l) => {
              const st = STATUS[l.status] ?? STATUS.new;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-[22px] py-3 sm:px-8">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium text-ink">{l.name || "ללא שם"}</span>
                    <span className="block truncate text-[13px] text-ink-muted">
                      <span dir="ltr" className="num">{l.phone}</span>
                      {l.tags.length > 0 && ` · ${l.tags.join(", ")}`}
                      {l.attempts > 0 && ` · ${l.attempts} ניסיונות`}
                      {l.last_result && ` · ${l.last_result}`}
                    </span>
                  </span>
                  <Pill tone={st.tone}>{st.label}</Pill>
                  {l.status !== "calling" && (
                    <form action={leadAction} className="flex gap-1">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="id" value={l.id} />
                      {l.status !== "queued" && l.status !== "dnc" && (
                        <button name="op" value="queue" className="min-h-9 rounded-full px-3 text-[13px] font-medium text-ink hover:bg-tint">
                          לתור
                        </button>
                      )}
                      {l.status === "queued" && (
                        <button name="op" value="reset" className="min-h-9 rounded-full px-3 text-[13px] font-medium text-ink hover:bg-tint">
                          הוצאה מהתור
                        </button>
                      )}
                      {l.status !== "dnc" ? (
                        <button name="op" value="dnc" className="min-h-9 rounded-full px-3 text-[13px] font-medium text-ink-muted hover:bg-tint">
                          לא להתקשר
                        </button>
                      ) : (
                        <button name="op" value="reset" className="min-h-9 rounded-full px-3 text-[13px] font-medium text-ink-muted hover:bg-tint">
                          ביטול חסימה
                        </button>
                      )}
                      <button name="op" value="delete" className="min-h-9 rounded-full px-3 text-[13px] font-medium text-destructive hover:bg-destructive-soft">
                        מחיקה
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {(page > 1 || list.length === PAGE) && (
          <div className="flex justify-between px-[22px] py-4 text-[15px] sm:px-8">
            {page > 1 ? <Link href={href({ page: String(page - 1) })}>→ הקודמים</Link> : <span />}
            {list.length === PAGE && <Link href={href({ page: String(page + 1) })}>הבאים ←</Link>}
          </div>
        )}
      </Panel>
    </div>
  );
}

import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { PageHeader, Panel, StateBlock } from "@/components/ds/primitives";
import { Pill } from "@/components/ds/StatusBadge";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "פגישות" };

async function cancel(form: FormData) {
  "use server";
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  await (await createClient()).from("appointments").update({ status: "cancelled" }).eq("id", String(form.get("id"))).eq("client_id", client.id).eq("status", "booked");
  revalidatePath(`/${slug}/meetings`);
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

type Row = { id: string; name: string; phone: string; email: string; starts_at: string; duration_minutes: number; note: string; status: string; agents: { name: string } | null };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { client } = await requireMember(slug);
  const db = await createClient();
  const now = new Date().toISOString();
  const cols = "id, name, phone, email, starts_at, duration_minutes, note, status, agents(name)";
  const [{ data: next }, { data: past }] = await Promise.all([
    db.from("appointments").select(cols).eq("client_id", client.id).gte("starts_at", now).order("starts_at").limit(200),
    db.from("appointments").select(cols).eq("client_id", client.id).lt("starts_at", now).order("starts_at", { ascending: false }).limit(50),
  ]);
  const list = (rows: Row[], canCancel: boolean) => (
    <ul className="divide-y divide-border">
      {rows.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-3 px-[22px] py-4 sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-medium text-ink">{when(m.starts_at)}</p>
            <p className="text-[15px] text-ink-muted">
              {[m.name, m.phone && <span key="p" dir="ltr" className="num">{m.phone}</span>, m.email].filter(Boolean).map((x, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {x}
                </span>
              ))}
            </p>
            {m.note && <p className="mt-1 text-[15px] text-ink">{m.note}</p>}
            <p className="mt-1 text-[13px] text-ink-muted">
              {m.duration_minutes} דקות{m.agents?.name ? ` · נקבעה על ידי ${m.agents.name}` : ""}
            </p>
          </div>
          {m.status === "cancelled" ? (
            <Pill tone="neutral">בוטלה</Pill>
          ) : canCancel ? (
            <form action={cancel}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={m.id} />
              <button className="min-h-10 rounded-full bg-muted px-4 text-[14px] font-medium text-ink">ביטול</button>
            </form>
          ) : (
            <Pill tone="success">התקיימה</Pill>
          )}
        </li>
      ))}
    </ul>
  );
  const upcoming = (next ?? []) as unknown as Row[];
  const earlier = (past ?? []) as unknown as Row[];
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="פגישות" description="פגישות שהסוכנים קבעו בשיחות. ביטול כאן משחרר את המועד." />
      <Panel title="קרובות" bodyClassName={upcoming.length ? "p-0 sm:p-0" : undefined}>
        {upcoming.length ? list(upcoming, true) : <StateBlock kind="empty" title="אין פגישות קרובות" description="כשסוכן יקבע פגישה בשיחה, היא תופיע כאן." />}
      </Panel>
      {earlier.length > 0 && (
        <Panel title="שעברו" bodyClassName="p-0 sm:p-0">
          {list(earlier, false)}
        </Panel>
      )}
    </div>
  );
}

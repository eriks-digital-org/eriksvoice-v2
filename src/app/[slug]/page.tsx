import Link from "next/link";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { StatTile } from "@/components/ds/kit";
import { AgentStatusBadge } from "@/components/ds/StatusBadge";
import { characterForType } from "@/components/agents/characters";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AgentRow } from "@/lib/data/types";

export default async function PortalHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { access, client } = await requireMember(slug);
  const supabase = await createClient();
  const [{ data: agents }, { data: row }] = await Promise.all([
    supabase.from("agents").select("id, client_id, type_key, name, status, voice_id, opening_line").eq("client_id", client.id).order("created_at"),
    supabase.from("clients").select("monthly_minutes").eq("id", client.id).maybeSingle(),
  ]);
  const list = (agents ?? []) as AgentRow[];
  const first = access.fullName.split(" ")[0];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title={`שלום ${first},`} soft="הצוות שלך כאן." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="שיחות היום" value={0} />
        <StatTile label="פגישות שנקבעו" value={0} />
        <StatTile label="לידים שמחכים" value={0} />
        <StatTile label="דקות שנשארו" value={(row?.monthly_minutes ?? 0).toLocaleString()} />
      </div>
      <Panel title="הצוות שלי" action={<Link href={`/${slug}/team`} className="text-[15px] font-medium text-violet">לכל הצוות</Link>}>
        {list.length === 0 ? (
          <p className="text-[16px] text-ink-muted">הסוכנים שלכם יופיעו כאן אחרי שנגדיר אותם.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((a) => {
              const c = characterForType(a.type_key, a.id);
              return (
                <li key={a.id} className="flex items-center gap-4 rounded-[22px] bg-muted/60 p-3">
                  <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: c.wash }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.smile} alt="" className="size-14 object-contain" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[17px] font-medium text-ink">{a.name}</span>
                  <AgentStatusBadge status={a.status} />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

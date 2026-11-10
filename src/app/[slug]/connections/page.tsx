import type { Metadata } from "next";
import { PageHeader } from "@/components/ds/primitives";
import { ConnBadge, Pill, type ConnStatus } from "@/components/ds/StatusBadge";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CONNECTIONS } from "@/lib/connections";
import { requestConnection } from "./actions";

export const metadata: Metadata = { title: "חיבורים" };

export default async function ConnectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { client } = await requireMember(slug);
  const supabase = await createClient();
  const { data } = await supabase.from("connections").select("kind, status").eq("client_id", client.id);
  const status = new Map((data ?? []).map((r) => [r.kind as string, r.status as ConnStatus]));

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="חיבורים" description="השירותים שהסוכנים והאוטומציות שלכם עובדים איתם. לוחצים על ״בקשת חיבור״, ואנחנו מחברים ובודקים." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {CONNECTIONS.filter((c) => !c.adminOnly).map((c) => {
          const s = status.get(c.kind) ?? "off";
          return (
            <li key={c.kind} className="surface flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-medium text-ink">{c.label}</h2>
                  <p className="mt-1 text-[15px] text-ink-muted">{c.description}</p>
                </div>
                {c.later ? <Pill tone="neutral">{c.later}</Pill> : <ConnBadge status={s} />}
              </div>
              {!c.later && (s === "off" || s === "error") && (
                <form action={requestConnection} className="mt-auto">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="kind" value={c.kind} />
                  <button className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-white">בקשת חיבור</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

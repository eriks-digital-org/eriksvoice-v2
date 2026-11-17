import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { CallList } from "@/components/calls/CallList";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { filterQuery, hasFilters, listCalls, pageOf, parseFilters } from "@/lib/calls/queries";
import { CallFilters } from "@/components/calls/CallFilters";
import { hangupCall, refreshLiveCalls } from "@/lib/calls/live";
import { AutoRefresh } from "@/components/calls/AutoRefresh";
import { revalidatePath } from "next/cache";

async function hangup(form: FormData) {
  "use server";
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  await hangupCall(String(form.get("call_id")), client.id);
  revalidatePath(`/${slug}/calls`);
}

export const metadata: Metadata = { title: "שיחות" };

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const { client } = await requireMember(slug);
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const filters = parseFilters(sp);
  const live = await refreshLiveCalls(client.id).catch(() => 0);
  const db = await createClient();
  const [calls, { data: agents }] = await Promise.all([
    listCalls(db, { clientId: client.id, page, filters }),
    db.from("agents").select("id, name").eq("client_id", client.id).order("created_at"),
  ]);
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="שיחות" description="כל השיחות של הסוכנים שלכם, עם הקלטה, תמלול וסיכום." />
      {live > 0 && <AutoRefresh />}
      <Panel bodyClassName="p-0 sm:p-0">
        <CallFilters filters={filters} agents={(agents ?? []) as { id: string; name: string }[]} basePath={`/${slug}/calls`} exportHref={`/api/calls/export`} exportParams={{ slug }} />
        <CallList
          filtered={hasFilters(filters)}
          hangup={hangup}
          hangupFields={{ slug }}
          calls={calls}
          page={page}
          hrefFor={(id) => `/${slug}/calls/${id}`}
          pageHref={(p) => `/${slug}/calls?${filterQuery(filters, { page: p })}`}
          emptyText="כשהסוכנים יתחילו לדבר עם לקוחות, השיחות יופיעו כאן."
        />
      </Panel>
    </div>
  );
}

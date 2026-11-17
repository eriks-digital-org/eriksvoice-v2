import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { CallList } from "@/components/calls/CallList";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { filterQuery, hasFilters, listCalls, pageOf, parseFilters } from "@/lib/calls/queries";
import { CallFilters } from "@/components/calls/CallFilters";
import { backfillClient } from "@/lib/calls/ingest";
import { isVoiceConfigured } from "@/lib/voice/elevenlabs";
import { hangupCall, refreshLiveCalls } from "@/lib/calls/live";
import { AutoRefresh } from "@/components/calls/AutoRefresh";

async function hangup(form: FormData) {
  "use server";
  await requireAdmin();
  await hangupCall(String(form.get("call_id")));
  revalidatePath("/admin/calls");
}

export const metadata: Metadata = { title: "שיחות" };

async function pullLatest(form: FormData) {
  "use server";
  await requireAdmin();
  if (!(await isVoiceConfigured())) return;
  const db = createAdminClient();
  const only = String(form.get("client") ?? "");
  let q = db.from("agents").select("client_id").not("provider_agent_id", "is", null);
  if (only) q = q.eq("client_id", only);
  const { data } = await q;
  for (const id of new Set((data ?? []).map((a) => a.client_id as string))) {
    await backfillClient(id, 30).catch((e) => console.error("backfill", id, e));
  }
  revalidatePath("/admin/calls");
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const clientId = sp.client && /^[0-9a-f-]{36}$/i.test(sp.client) ? sp.client : undefined;
  const filters = parseFilters(sp);
  const db = createAdminClient();
  const live = await refreshLiveCalls(clientId).catch(() => 0);
  const [{ data: clients }, calls, { data: agents }] = await Promise.all([
    db.from("clients").select("id, name").order("name"),
    listCalls(db, { clientId, page, withClient: !clientId, filters }),
    clientId ? db.from("agents").select("id, name").eq("client_id", clientId).order("created_at") : Promise.resolve({ data: [] }),
  ]);
  const keep: Record<string, string> = clientId ? { client: clientId } : {};
  const qs = (p: number) => `/admin/calls?${filterQuery(filters, { ...keep, page: p })}`;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="שיחות"
        description="כל השיחות מכל הלקוחות, כולל שיחות יוצאות שעוד פתוחות ושיחות שנכשלו. שיחה שהסתיימה מגיעה עם הקלטה, תמלול וסיכום."
        actions={
          <form action={pullLatest}>
            <input type="hidden" name="client" value={clientId ?? ""} />
            <button className="min-h-11 rounded-full bg-card px-4 text-[15px] font-medium text-ink shadow-soft">משיכת שיחות אחרונות</button>
          </form>
        }
      />
      <form className="flex max-w-md gap-2">
        <select
          name="client"
          defaultValue={clientId ?? ""}
          className="h-12 flex-1 rounded-2xl border border-border bg-card px-3 text-[16px] text-ink"
        >
          <option value="">כל הלקוחות</option>
          {(clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="min-h-12 rounded-full bg-ink px-5 text-[15px] font-medium text-white">סינון</button>
      </form>
      {live > 0 && <AutoRefresh />}
      <Panel bodyClassName="p-0 sm:p-0">
        <CallFilters filters={filters} agents={(agents ?? []) as { id: string; name: string }[]} basePath="/admin/calls" exportHref="/api/calls/export" hidden={keep} />
        <CallList
          filtered={hasFilters(filters)}
          hangup={hangup}
          calls={calls}
          page={page}
          hrefFor={(id) => `/admin/calls/${id}`}
          pageHref={qs}
          emptyText="שיחות מופיעות כאן אחרי שהן מסתיימות. אם עברה שיחה ולא הופיעה, לוחצים על משיכת שיחות אחרונות."
        />
      </Panel>
    </div>
  );
}

import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { CallList } from "@/components/calls/CallList";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCalls, pageOf } from "@/lib/calls/queries";
import { backfillClient } from "@/lib/calls/ingest";
import { isVoiceConfigured } from "@/lib/voice/elevenlabs";

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

export default async function Page({ searchParams }: { searchParams: Promise<{ client?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const clientId = sp.client && /^[0-9a-f-]{36}$/i.test(sp.client) ? sp.client : undefined;
  const db = createAdminClient();
  const [{ data: clients }, calls] = await Promise.all([
    db.from("clients").select("id, name").order("name"),
    listCalls(db, { clientId, page, withClient: !clientId }),
  ]);
  const qs = (p: number) => `/admin/calls?${new URLSearchParams({ ...(clientId ? { client: clientId } : {}), page: String(p) })}`;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="שיחות"
        description="כל השיחות מכל הלקוחות. שיחה נכנסת לכאן כשהיא מסתיימת, עם הקלטה, תמלול וסיכום."
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
      <Panel bodyClassName="p-0 sm:p-0">
        <CallList
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

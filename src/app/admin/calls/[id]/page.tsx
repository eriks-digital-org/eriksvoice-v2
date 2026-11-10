import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ds/primitives";
import { CallDetail } from "@/components/calls/CallDetail";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCall } from "@/lib/calls/queries";

export const metadata: Metadata = { title: "שיחה" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const db = createAdminClient();
  const call = await getCall(db, (await params).id);
  if (!call) notFound();
  const { data: client } = await db.from("calls").select("clients(id, name)").eq("id", call.id).single();
  const c = (client as unknown as { clients: { id: string; name: string } | null } | null)?.clients;
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title={call.external_number || "שיחה"}
        description={[c?.name, call.agent_name].filter(Boolean).join(" · ")}
        actions={
          c && (
            <Link href={`/admin/clients/${c.id}`} className="min-h-11 rounded-full bg-card px-4 py-2.5 text-[15px] font-medium text-ink shadow-soft">
              למסך הלקוח
            </Link>
          )
        }
      />
      <CallDetail call={call} />
    </div>
  );
}

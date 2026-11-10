import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ds/primitives";
import { CallDetail } from "@/components/calls/CallDetail";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCall } from "@/lib/calls/queries";

export const metadata: Metadata = { title: "שיחה" };

export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { client } = await requireMember(slug);
  const call = await getCall(await createClient(), id, client.id);
  if (!call) notFound();
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title={call.external_number || "שיחה"} description={call.agent_name ?? undefined} />
      <CallDetail call={call} />
    </div>
  );
}

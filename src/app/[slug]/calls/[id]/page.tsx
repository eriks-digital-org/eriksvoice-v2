import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ds/primitives";
import { CallDetail } from "@/components/calls/CallDetail";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCall } from "@/lib/calls/queries";
import { isResult } from "@/components/calls/format";
import { revalidatePath } from "next/cache";

async function saveResult(form: FormData) {
  "use server";
  const slug = String(form.get("slug"));
  const { client } = await requireMember(slug);
  const id = String(form.get("call_id"));
  const r = String(form.get("result") ?? "");
  await (await createClient())
    .from("calls")
    .update({ result: isResult(r) ? r : null, result_note: String(form.get("result_note") ?? "").trim().slice(0, 300) })
    .eq("id", id)
    .eq("client_id", client.id);
  revalidatePath(`/${slug}/calls/${id}`);
}

export const metadata: Metadata = { title: "שיחה" };

export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { client } = await requireMember(slug);
  const call = await getCall(await createClient(), id, client.id);
  if (!call) notFound();
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title={call.external_number || "שיחה"} description={call.agent_name ?? undefined} />
      <CallDetail call={call} saveResult={saveResult} resultFields={{ slug }} />
    </div>
  );
}

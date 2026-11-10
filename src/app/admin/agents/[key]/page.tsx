import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ds/primitives";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AGENT_TYPE_KEYS, type AgentTypeKey } from "@/lib/agent-types";
import type { AgentTypeRow } from "@/lib/data/types";
import { TypeForm } from "./TypeForm";

export default async function AgentTypePage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin();
  const { key } = await params;
  if (!AGENT_TYPE_KEYS.includes(key as AgentTypeKey)) notFound();
  const { data } = await createAdminClient().from("agent_types").select("*").eq("key", key).maybeSingle<AgentTypeRow>();
  if (!data) notFound();
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title={data.name} description={data.purpose} />
      <TypeForm type={data} />
    </div>
  );
}

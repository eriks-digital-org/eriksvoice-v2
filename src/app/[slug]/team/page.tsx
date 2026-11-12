import type { Metadata } from "next";
import { PageHeader, StateBlock } from "@/components/ds/primitives";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AgentRow, PhoneRow } from "@/lib/data/types";
import { AgentCard } from "./AgentCard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AllowedVoice } from "@/lib/voice/models";
import { agentTypeLabels, type AgentTypeKey } from "@/lib/agent-types";

export const metadata: Metadata = { title: "הצוות שלי" };

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { client } = await requireMember(slug);
  const supabase = await createClient();
  const [{ data: agents }, { data: phones }] = await Promise.all([
    supabase.from("agents").select("id, client_id, type_key, name, status, voice_id, opening_line").eq("client_id", client.id).order("created_at"),
    supabase.from("phone_numbers").select("id, client_id, e164, agent_id, is_primary, label").eq("client_id", client.id),
  ]);
  const list = (agents ?? []) as AgentRow[];
  // Only the voice names the admin allowed per type (no prompts or models).
  const { data: types } = await createAdminClient().from("agent_types").select("key, name, allowed_voices");
  const voicesOf = (key: string) => ((types ?? []).find((t) => t.key === key)?.allowed_voices ?? []) as AllowedVoice[];
  const typeName = (key: string) => (types ?? []).find((t) => t.key === key)?.name?.trim() || agentTypeLabels[key as AgentTypeKey] || key;
  const phoneList = (phones ?? []) as PhoneRow[];
  const primary = phoneList.find((p) => p.is_primary)?.e164;
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="הצוות שלי" description="הסוכנים שעונים ומתקשרים בשם העסק. אפשר לשנות לכל אחד שם, קול ומשפט פתיח." />
      {list.length === 0 ? (
        <div className="surface">
          <StateBlock kind="empty" title="עוד אין סוכנים" description="הסוכנים שלכם יופיעו כאן אחרי שנגדיר אותם." />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {list.map((a) => (
            <AgentCard key={a.id} agent={a} typeName={typeName(a.type_key)} slug={slug} phone={phoneList.find((p) => p.agent_id === a.id)?.e164 ?? primary} voices={voicesOf(a.type_key)} />
          ))}
        </div>
      )}
    </div>
  );
}

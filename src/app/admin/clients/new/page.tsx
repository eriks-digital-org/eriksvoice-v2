import type { Metadata } from "next";
import { PageHeader } from "@/components/ds/primitives";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Wizard } from "./Wizard";

export const metadata: Metadata = { title: "לקוח חדש" };

export default async function NewClientPage() {
  await requireAdmin();
  const { data } = await createAdminClient().from("agent_types").select("key, purpose");
  const purposes = Object.fromEntries((data ?? []).map((r) => [r.key, r.purpose]));
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="לקוח חדש" soft="בשלושה צעדים." description="פרטי העסק, אילו סוכנים ליצור, ומספר טלפון אם כבר יש." />
      <Wizard purposes={purposes} />
    </div>
  );
}

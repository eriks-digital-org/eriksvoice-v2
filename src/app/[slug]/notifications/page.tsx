import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { NotificationList, type NotificationItem } from "@/components/common/NotificationList";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "התראות" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { client } = await requireMember((await params).slug);
  const db = await createClient();
  const { data } = await db
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = (data ?? []) as NotificationItem[];
  // Opening the page marks everything as read (the list above still shows what was new).
  if (items.some((n) => !n.read_at)) {
    await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("client_id", client.id).is("read_at", null);
  }
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="התראות" description="כל מה שחשוב לדעת: מכסת דקות, חיבורים ועוד. התראות חשובות נשלחות גם במייל." />
      <Panel bodyClassName="p-0 sm:p-0">
        <NotificationList items={items} />
      </Panel>
    </div>
  );
}

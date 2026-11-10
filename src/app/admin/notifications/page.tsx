import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { NotificationList, type NotificationItem } from "@/components/common/NotificationList";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "התראות" };

export default async function Page() {
  await requireAdmin();
  const db = createAdminClient();
  const { data } = await db
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .is("client_id", null)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = (data ?? []) as NotificationItem[];
  if (items.some((n) => !n.read_at)) {
    await db.from("notifications").update({ read_at: new Date().toISOString() }).is("client_id", null).is("read_at", null);
  }
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="התראות" description="התראות מערכת. נשלחות גם לכתובות המייל שבהגדרות." />
      <Panel bodyClassName="p-0 sm:p-0">
        <NotificationList items={items} />
      </Panel>
    </div>
  );
}

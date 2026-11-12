import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ds/primitives";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClientRow } from "@/lib/data/types";
import { EditForm } from "./EditForm";

export const metadata: Metadata = { title: "עריכת לקוח" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: c } = await createAdminClient().from("clients").select("*").eq("id", id).maybeSingle<ClientRow>();
  if (!c) notFound();
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title={`עריכת ${c.name}`}
        description="פרטי העסק. שם, תחום, כתובת, טלפון ושעות מתעדכנים גם אצל הסוכנים הפעילים."
        actions={
          <Link href={`/admin/clients/${c.id}`} className="min-h-11 rounded-full bg-card px-4 py-2.5 text-[15px] font-medium text-ink shadow-soft">
            חזרה ללקוח
          </Link>
        }
      />
      <EditForm
        v={{
          id: c.id,
          name: c.name,
          slug: c.slug,
          industry: c.industry,
          address: c.address,
          hours: (c.business_hours as { summary?: string } | null)?.summary ?? "",
          contact_phone: c.contact_phone,
          notify_email: c.notify_email,
          description: c.description,
          monthly_minutes: c.monthly_minutes,
        }}
      />
    </div>
  );
}

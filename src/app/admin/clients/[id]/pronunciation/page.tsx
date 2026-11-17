import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ds/primitives";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PronunciationRow } from "@/lib/voice/pronunciation";
import { PronunciationEditor } from "@/app/admin/settings/pronunciation/PronunciationEditor";

export const metadata: Metadata = { title: "מילון הגייה של העסק" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const [{ data: client }, { data }] = await Promise.all([
    db.from("clients").select("id, name").eq("id", id).maybeSingle(),
    db.from("pronunciation_rules").select("id, term, say, note, category, enabled").eq("client_id", id).order("position"),
  ]);
  if (!client) notFound();
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title={`מילון הגייה: ${client.name}`}
        description="מילים של העסק הזה בלבד, כמו שם העסק, רחובות, מוצרים ושמות אנשי צוות. הן גוברות על המילון המשותף, ונשלחות רק לסוכנים של העסק."
        actions={
          <Link href={`/admin/clients/${id}`} className="min-h-11 rounded-full bg-card px-4 py-2.5 text-[15px] font-medium text-ink shadow-soft">
            חזרה ללקוח
          </Link>
        }
      />
      <PronunciationEditor rows={(data ?? []) as PronunciationRow[]} clientId={id} />
    </div>
  );
}

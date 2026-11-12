import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ds/primitives";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PronunciationRow } from "@/lib/voice/pronunciation";
import { PronunciationEditor } from "./PronunciationEditor";

export const metadata: Metadata = { title: "מילון הגייה" };

export default async function PronunciationPage() {
  await requireAdmin();
  const { data } = await createAdminClient()
    .from("pronunciation_rules")
    .select("id, term, say, note, category, enabled")
    .order("position");
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="מילון הגייה"
        description="איך הקול אומר מילים שהסוכן כותב, למשל CRM ← סי. אָר. אֶם. המילון משותף לכל הסוכנים של כל הלקוחות, ומשפיע רק על הדיבור: הפרומפט לא משתנה. ההתאמה רגישה לאותיות גדולות וקטנות, והמערכת מוסיפה לבד את הצורות הנפוצות (lead, Lead)."
        actions={
          <Link href="/admin/settings" className="min-h-11 rounded-full bg-card px-4 py-2.5 text-[15px] font-medium text-ink shadow-soft">
            חזרה להגדרות
          </Link>
        }
      />
      <PronunciationEditor rows={(data ?? []) as PronunciationRow[]} />
    </div>
  );
}

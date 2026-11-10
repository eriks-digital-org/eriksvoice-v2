import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/ComingSoon";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "תקינות מערכת" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="תקינות מערכת" description="מצב הספקים ותקלות לפי לקוח." items={["מצב ElevenLabs, Twilio, Activepieces ומיילים", "סוכנים שהסנכרון שלהם נכשל, עם ניסיון חוזר", "אוטומציות שנעצרו וחיבורים מנותקים"]} />;
}

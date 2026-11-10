import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/ComingSoon";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "שיחות" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireMember((await params).slug);
  return <ComingSoon title="שיחות" description="כל השיחות של הסוכנים שלכם." items={["רשימה עם סינון", "הקלטה, תמלול מלא, סיכום ותוצאה"]} />;
}

import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/ComingSoon";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "אוטומציות" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireMember((await params).slug);
  return <ComingSoon title="אוטומציות" description="התהליכים שרצים אצלכם." items={["התהליכים שלי כסיפור", "גלריית תבניות", "בונה: כאשר ← אז ← מתי ← סיכום", "מתג פעיל/מושהה ויומן ריצות"]} />;
}

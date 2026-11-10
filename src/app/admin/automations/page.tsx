import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/ComingSoon";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "תבניות אוטומציה" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="תבניות אוטומציה" description="תבניות שזמינות לכל הלקוחות." items={["בונה: טריגר, השהיה ופעולות", "12 התבניות מהעיצוב החדש, התראות וסיכום שבועי", "עריכה, מחיקה והסתרה של תבנית"]} />;
}

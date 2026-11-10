import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/ComingSoon";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "שיחות" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="שיחות" description="כל השיחות מכל הלקוחות." items={["סינון לפי לקוח, סוכן, תוצאה ותאריך", "הקלטה, תמלול מלא, סיכום וזמני תגובה", "ניתוק שיחה פעילה"]} />;
}

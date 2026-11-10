import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/ComingSoon";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "שימוש" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="שימוש" description="דקות לפי לקוח ולפי סוכן." items={["דקות החודש מול המכסה לכל לקוח", "פירוט לפי סוכן", "התראה ב־80% וחסימת שיחות יוצאות ב־100%"]} />;
}

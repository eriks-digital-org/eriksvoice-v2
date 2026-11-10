import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/ComingSoon";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "דקות וחשבון" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireMember((await params).slug);
  return <ComingSoon title="דקות וחשבון" description="השימוש החודש מול המכסה." items={["דקות לפי סוכן", "הזמנת משתמשים נוספים"]} />;
}

import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/ComingSoon";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "רשימת חיוג" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireMember((await params).slug);
  return <ComingSoon title="רשימת חיוג" description="לידים, תיקיות ותותח שיחות." items={["העלאת CSV או Excel, והוספה ידנית", "תיקיות, וליד יכול להיות בכמה תיקיות", "תותח שיחות: 3 במקביל, רק בשעות הפעילות", "רשימת \"אל תתקשר\""]} />;
}

import type { Metadata } from "next";
import { ComingSoon } from "@/components/common/ComingSoon";
import { requireMember } from "@/lib/auth";

export const metadata: Metadata = { title: "התראות" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireMember((await params).slug);
  return <ComingSoon title="התראות" description="כל מה שקרה אצלכם." items={["פעמון והיסטוריה", "התראות שמפעילים ומכבים כתבניות אוטומציה"]} />;
}

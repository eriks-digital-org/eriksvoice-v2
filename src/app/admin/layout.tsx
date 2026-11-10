import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "פאנל ניהול", template: "%s · ניהול · EriksVoice" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAdmin();
  return (
    <AppShell
      mode="admin"
      root="/admin"
      userName={access.fullName}
      switches={access.clients.map((c) => ({ href: `/${c.slug}`, label: c.name, kind: "client" as const }))}
    >
      {children}
    </AppShell>
  );
}

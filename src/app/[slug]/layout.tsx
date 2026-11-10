import { AppShell } from "@/components/layout/AppShell";
import { requireMember } from "@/lib/auth";

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { access, client } = await requireMember(slug);
  const switches = [
    ...(access.isAdmin ? [{ href: "/admin", label: "פאנל ניהול", kind: "admin" as const }] : []),
    ...access.clients.filter((c) => c.id !== client.id).map((c) => ({ href: `/${c.slug}`, label: c.name, kind: "client" as const })),
  ];
  return (
    <AppShell mode="portal" root={`/${client.slug}`} userName={access.fullName} clientName={client.name} switches={switches}>
      {children}
    </AppShell>
  );
}

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export interface Membership {
  id: string;
  slug: string;
  name: string;
}

export interface Access {
  userId: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  clients: Membership[];
}

/** Who is signed in, whether they are a system admin, and which clients they belong to. */
export const getAccess = cache(async (): Promise<Access | null> => {
  await cookies(); // always per request, also before Supabase is connected
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  // getClaims checks the session token's signature locally (no round trip to Supabase Auth
  // on every screen); it falls back to asking Auth only for projects without signing keys.
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return null;
  const user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("full_name, is_admin").eq("id", user.id).maybeSingle(),
    supabase.from("client_members").select("clients(id, slug, name)").eq("user_id", user.id),
  ]);
  const clients = (rows ?? [])
    .map((r) => r.clients as unknown as Membership | null)
    .filter((c): c is Membership => Boolean(c))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name || (user.email ?? "").split("@")[0] || "",
    isAdmin: Boolean(profile?.is_admin),
    clients,
  };
});

/** Where a user lands after signing in. */
export function homeFor(access: Access): string | null {
  if (access.isAdmin) return "/admin";
  const first = access.clients[0];
  return first ? `/${first.slug}` : null;
}

/**
 * Where a user goes right after signing in or choosing a password, from their id
 * (inside a server action, before the new session cookies are readable).
 */
export async function homeForUser(userId: string, email: string): Promise<string> {
  const db = createAdminClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    db.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
    db.from("client_members").select("clients(slug, name)").eq("user_id", userId),
  ]);
  if (profile?.is_admin || (await promoteListedAdmin(userId, email))) return "/admin";
  const slugs = (rows ?? [])
    .map((r) => r.clients as unknown as { slug: string; name: string } | null)
    .filter((c): c is { slug: string; name: string } => Boolean(c))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  return slugs[0] ? `/${slugs[0].slug}` : "/login?error=no-access";
}

/** Admin panel pages and actions. */
export async function requireAdmin(): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect("/login");
  if (!access.isAdmin) redirect(homeFor(access) ?? "/login?error=no-access");
  return access;
}

/**
 * A client's portal. Only that client's members get in. The system admin is no
 * exception: they manage clients from the admin panel, not from inside a portal.
 */
export async function requireMember(slug: string): Promise<{ access: Access; client: Membership }> {
  const access = await getAccess();
  if (!access) redirect(`/login?next=/${encodeURIComponent(slug)}`);
  const client = access.clients.find((c) => c.slug === slug);
  if (!client) notFound();
  return { access, client };
}

/**
 * First sign-in of a system admin: an email listed in ADMIN_EMAILS (Vercel env) becomes
 * an admin. Nobody can make themselves an admin from the browser.
 */
export async function promoteListedAdmin(userId: string, email: string) {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!list.includes(email.toLowerCase())) return false;
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", userId);
  return !error;
}

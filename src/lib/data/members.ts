import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/site";

/**
 * Adds a user to a client. A new address gets an invitation email (Supabase Auth,
 * sent through the SMTP set in Supabase); an existing user is just added.
 */
export async function inviteMember(clientId: string, email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createAdminClient();
  const address = email.trim().toLowerCase();

  const { data: existing } = await db.from("profiles").select("id").eq("email", address).maybeSingle();
  let userId = existing?.id as string | undefined;

  if (!userId) {
    const origin = await siteOrigin();
    const { data, error } = await db.auth.admin.inviteUserByEmail(address, {
      redirectTo: `${origin}/auth/confirm?next=/set-password`,
    });
    if (error || !data.user) return { ok: false, error: "שליחת ההזמנה במייל נכשלה" };
    userId = data.user.id;
  }

  const { error } = await db.from("client_members").upsert({ client_id: clientId, user_id: userId });
  if (error) return { ok: false, error: "שיוך המשתמש ללקוח נכשל" };
  return { ok: true };
}

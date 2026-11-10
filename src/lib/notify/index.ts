import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "./mail";

export interface Notice {
  /** null = for the system admin */
  clientId: string | null;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  /** also email it (client: its members; admin: the alert emails in Settings) */
  email?: boolean;
}

/** Saves a notification (bell + history) and optionally emails it. */
export async function notify(n: Notice) {
  const db = createAdminClient();
  await db.from("notifications").insert({ client_id: n.clientId, kind: n.kind, title: n.title, body: n.body ?? "", link: n.link ?? null });
  if (!n.email) return;
  let to: string[] = [];
  if (n.clientId) {
    const { data } = await db.from("client_members").select("profiles:user_id(email)").eq("client_id", n.clientId);
    to = ((data ?? []) as unknown as { profiles: { email: string } | null }[]).map((m) => m.profiles?.email ?? "").filter(Boolean);
  } else {
    const { data } = await db.from("system_settings").select("alert_emails").eq("id", true).maybeSingle();
    to = (data?.alert_emails as string[] | undefined) ?? [];
  }
  await sendMail(to, n.title, [n.title, n.body].filter(Boolean).join("\n"), n.link);
}

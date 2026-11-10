"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONNECTIONS } from "@/lib/connections";

/** "בקשת חיבור": marks the connection as requested and tells the admin. */
export async function requestConnection(form: FormData) {
  const slug = String(form.get("slug"));
  const kind = String(form.get("kind"));
  const { client } = await requireMember(slug);
  const def = CONNECTIONS.find((c) => c.kind === kind);
  if (!def || def.later || def.adminOnly) return;
  const db = createAdminClient();
  const { data: existing } = await db.from("connections").select("status").eq("client_id", client.id).eq("kind", kind).maybeSingle();
  if (existing && existing.status !== "off" && existing.status !== "error") return;
  await db
    .from("connections")
    .upsert({ client_id: client.id, kind, status: "requested", requested_at: new Date().toISOString() }, { onConflict: "client_id,kind" });
  await db.from("notifications").insert({
    client_id: null,
    kind: "connection_request",
    title: `בקשת חיבור: ${def.label}`,
    body: client.name,
    link: `/admin/clients/${client.id}`,
  });
  revalidatePath(`/${slug}/connections`);
}

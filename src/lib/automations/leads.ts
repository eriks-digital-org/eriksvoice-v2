import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "./engine";

/** Fires "lead_new" for leads that were just added (by id). */
export async function emitNewLeads(ids: string[]) {
  if (!ids.length) return;
  const { data } = await createAdminClient().from("leads").select("id, client_id, name, phone, email, tags").in("id", ids.slice(0, 500));
  for (const l of data ?? []) {
    await emit({
      type: "lead_new",
      clientId: l.client_id,
      key: `lead:${l.id}:new`,
      contact: { name: l.name, phone: l.phone, email: l.email, leadId: l.id },
      lead: { id: l.id, tags: l.tags as string[] },
    });
  }
}

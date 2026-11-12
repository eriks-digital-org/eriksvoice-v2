import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { crmConnected, findLeads } from "@/lib/crm/erikscrm";

/**
 * What the agent knows about the person on the line, as dynamic variables the prompts can use:
 * {{caller_name}}, {{caller_known}}, {{caller_phone}}, {{caller_tags}}, {{caller_calls}},
 * {{caller_last_summary}}, {{caller_status}} (the CRM stage). Always the same keys (empty
 * when unknown), because the voice service refuses a call when a variable used in the prompt has no value.
 * Sources: the business's own leads and calls, and its CRM card when ERIKSCRM is connected
 * (the CRM wins for name, tags and status; it gets 2.5 seconds, so a slow CRM never holds the call).
 */
export async function callerVariables(clientId: string, phone: string): Promise<Record<string, string>> {
  const vars: Record<string, string> = {
    caller_phone: phone,
    caller_name: "",
    caller_known: "לא",
    caller_tags: "",
    caller_calls: "0",
    caller_last_summary: "",
    caller_status: "",
  };
  if (!phone) return vars;
  const db = createAdminClient();
  // Asked in parallel with our own records.
  const crmLookup = crmConnected(clientId)
    .then((on) => (on ? findLeads(clientId, phone, 2500) : []))
    .then((list) => list[0] ?? null)
    .catch(() => null);
  const [{ data: lead }, { data: calls, count }] = await Promise.all([
    db.from("leads").select("name, tags").eq("client_id", clientId).eq("phone", phone).maybeSingle(),
    db
      .from("calls")
      .select("summary", { count: "exact" })
      .eq("client_id", clientId)
      .eq("external_number", phone)
      .not("status", "in", "(failed,no_answer)")
      .order("started_at", { ascending: false })
      .limit(1),
  ]);
  if (lead?.name) vars.caller_name = lead.name as string;
  if (lead) vars.caller_tags = ((lead.tags as string[]) ?? []).join(", ");
  vars.caller_calls = String(count ?? 0);
  vars.caller_last_summary = ((calls?.[0]?.summary as string) ?? "").slice(0, 500);
  if (lead || (count ?? 0) > 0) vars.caller_known = "כן";

  const crm = await crmLookup;
  if (crm) {
    vars.caller_known = "כן";
    if (crm.name) vars.caller_name = crm.name;
    if (crm.tags?.length) vars.caller_tags = crm.tags.join(", ");
    vars.caller_status = crm.status ?? "";
    const last = crm.latest_activity?.description ?? "";
    if (!vars.caller_last_summary && last) vars.caller_last_summary = last.slice(0, 500);
  }
  return vars;
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What the agent knows about the person on the line, as dynamic variables the prompts can use:
 * {{caller_name}}, {{caller_known}}, {{caller_phone}}, {{caller_tags}}, {{caller_calls}},
 * {{caller_last_summary}}. Always the same keys (empty when unknown), because the voice
 * service refuses a call when a variable used in the prompt has no value.
 * Today the source is the business's own leads and calls; the CRM is added here later.
 */
export async function callerVariables(clientId: string, phone: string): Promise<Record<string, string>> {
  const vars: Record<string, string> = {
    caller_phone: phone,
    caller_name: "",
    caller_known: "לא",
    caller_tags: "",
    caller_calls: "0",
    caller_last_summary: "",
  };
  if (!phone) return vars;
  const db = createAdminClient();
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
  return vars;
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { agentTypeLabels } from "@/lib/agent-types";

/**
 * The type names as the admin set them (agent_types.name), so a rename in the admin
 * shows at every client. The built-in labels are only the fallback for an empty name.
 */
export async function agentTypeNames(): Promise<Record<string, string>> {
  const { data } = await createAdminClient().from("agent_types").select("key, name");
  const names: Record<string, string> = { ...agentTypeLabels };
  for (const r of data ?? []) if (r.name?.trim()) names[r.key as string] = r.name.trim();
  return names;
}

import type { CallFull, CallListItem } from "@/components/calls/format";
import { CALLS_PAGE } from "@/components/calls/format";

type Db = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const LIST = "id, direction, external_number, outcome, status, end_reason, started_at, duration_secs, summary, agents(name)";

type Raw = Omit<CallListItem, "agent_name" | "client_name"> & { agents: { name: string } | null; clients?: { name: string } | null };
const flat = (r: Raw): CallListItem => ({ ...r, agent_name: r.agents?.name ?? null, client_name: r.clients?.name ?? null });

/** One page of calls, newest first. Pass the user's client in the portal (RLS applies). */
export async function listCalls(db: Db, opts: { clientId?: string; page: number; withClient?: boolean }): Promise<CallListItem[]> {
  const from = (opts.page - 1) * CALLS_PAGE;
  let q = db
    .from("calls")
    .select(opts.withClient ? `${LIST}, clients(name)` : LIST)
    .order("started_at", { ascending: false })
    .range(from, from + CALLS_PAGE - 1);
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  const { data } = await q;
  return ((data ?? []) as Raw[]).map(flat);
}

export async function getCall(db: Db, id: string, clientId?: string): Promise<CallFull | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  let q = db.from("calls").select(`${LIST}, agent_number, has_audio, transcript, collected, client_id`).eq("id", id);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q.maybeSingle();
  if (!data) return null;
  const r = data as Raw & Omit<CallFull, keyof CallListItem>;
  return { ...r, agent_name: r.agents?.name ?? null };
}

export const pageOf = (v: string | undefined) => Math.max(1, Math.min(1000, Number.parseInt(v ?? "1", 10) || 1));

import type { CallFull, CallListItem } from "@/components/calls/format";
import { CALLS_PAGE, isResult } from "@/components/calls/format";

type Db = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const LIST = "id, direction, external_number, outcome, status, end_reason, started_at, duration_secs, summary, result, result_note, agents(name)";

type Raw = Omit<CallListItem, "agent_name" | "client_name"> & { agents: { name: string } | null; clients?: { name: string } | null };
const flat = (r: Raw): CallListItem => ({ ...r, agent_name: r.agents?.name ?? null, client_name: r.clients?.name ?? null });

/** Filters of the calls screens (from the address bar). */
export interface CallFilters {
  /** part of the phone number */
  q?: string;
  direction?: "inbound" | "outbound" | "web";
  /** a result key, or "none" for calls without one */
  result?: string;
  agent?: string;
  /** YYYY-MM-DD, Israel time */
  from?: string;
  to?: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export function parseFilters(sp: Record<string, string | string[] | undefined>): CallFilters {
  const v = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const f: CallFilters = {};
  const q = v("q").replace(/[^\d+]/g, "").slice(0, 20);
  if (q) f.q = q;
  const d = v("direction");
  if (d === "inbound" || d === "outbound" || d === "web") f.direction = d;
  const r = v("result");
  if (r === "none" || isResult(r)) f.result = r;
  if (UUID.test(v("agent"))) f.agent = v("agent");
  if (DAY.test(v("from"))) f.from = v("from");
  if (DAY.test(v("to"))) f.to = v("to");
  return f;
}

export const hasFilters = (f: CallFilters) => Object.keys(f).length > 0;

/** The filters as an address query (without "?"), plus extra params. */
export function filterQuery(f: CallFilters, extra: Record<string, string | number> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v !== undefined && v !== "") p.set(k, String(v));
  return p.toString();
}

/** Israel-time midnight of a YYYY-MM-DD day, as ISO (DST-safe enough: +02/+03 by month). */
function israelMidnight(day: string, addDays = 0): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + addDays);
  const iso = d.toISOString().slice(0, 10);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", timeZoneName: "shortOffset" })
    .formatToParts(new Date(`${iso}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") ?? "+2";
  const hours = Number(offset) || 2;
  return new Date(`${iso}T00:00:00+0${hours}:00`).toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters(q: any, f: CallFilters) {
  if (f.q) q = q.ilike("external_number", `%${f.q}%`);
  if (f.direction) q = q.eq("direction", f.direction);
  if (f.result === "none") q = q.is("result", null);
  else if (f.result) q = q.eq("result", f.result);
  if (f.agent) q = q.eq("agent_id", f.agent);
  if (f.from) q = q.gte("started_at", israelMidnight(f.from));
  if (f.to) q = q.lt("started_at", israelMidnight(f.to, 1));
  return q;
}

/** One page of calls, newest first. Pass the user's client in the portal (RLS applies). */
export async function listCalls(db: Db, opts: { clientId?: string; page: number; withClient?: boolean; filters?: CallFilters }): Promise<CallListItem[]> {
  const from = (opts.page - 1) * CALLS_PAGE;
  let q = db
    .from("calls")
    .select(opts.withClient ? `${LIST}, clients(name)` : LIST)
    .order("started_at", { ascending: false })
    .range(from, from + CALLS_PAGE - 1);
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  q = applyFilters(q, opts.filters ?? {});
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

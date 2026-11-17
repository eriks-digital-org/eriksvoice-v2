import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSecret } from "@/lib/providers/secrets";

type Db = ReturnType<typeof createAdminClient>;

/**
 * The business's own calendar (e.g. Google Calendar), reached through its Activepieces flow
 * while the agent is on the line. The flow's webhook is called on its synchronous address
 * (".../sync") and must end with a "Return Response" step. Same envelope as the automations:
 * { action, client, params, event }.
 *
 * Actions the flow handles:
 * - calendar_events { from, to, phone? } → the events in that range (all, or only the caller's
 *   when phone is given). Answer: a list of events, or { events: [...] } / { items: [...] }.
 * - calendar_create { start, end, title, description, email, phone, timezone } → { id }
 * - calendar_delete { event_id } → anything 2xx
 */

export interface CalEvent {
  id: string;
  start: number;
  end: number;
  title: string;
  description: string;
}

export class NoCalendar extends Error {}

/** The synchronous address of an Activepieces webhook (adds "/sync" once). */
export const syncUrl = (url: string) => (/\/sync\/?$/.test(url) ? url : `${url.replace(/\/+$/, "")}/sync`);

export async function flowUrl(db: Db, clientId: string): Promise<string | null> {
  const { data } = await db.from("connections").select("flow_url").eq("client_id", clientId).eq("kind", "activepieces").maybeSingle();
  return (data as { flow_url?: string | null } | null)?.flow_url ?? null;
}

/** Calls the business's flow and waits for its answer (JSON when it is JSON). */
export async function callFlow(url: string, slug: string, action: string, params: Record<string, unknown>, timeoutMs = 12_000): Promise<unknown> {
  const body = JSON.stringify({ action, client: slug, params, event: { type: "call_tool", live: true } });
  const secret = await getSecret("activepieces_signing_secret");
  const ts = Math.floor(Date.now() / 1000).toString();
  const res = await fetch(syncUrl(url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-EriksVoice-Timestamp": ts, "X-EriksVoice-Signature": createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex") } : {}),
    },
    body,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw new Error("היומן לא ענה בזמן");
  if (!res.ok) throw new Error(`היומן החזיר ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const time = (v: unknown): number => {
  if (typeof v === "string") return Date.parse(v);
  if (v && typeof v === "object") {
    const o = v as { dateTime?: string; date?: string };
    return Date.parse(o.dateTime ?? o.date ?? "");
  }
  return NaN;
};

/** Events from whatever the flow returned (Google Calendar items, or a simple list). */
export function parseEvents(raw: unknown): CalEvent[] {
  let list: unknown = raw;
  if (list && typeof list === "object" && !Array.isArray(list)) {
    const o = list as Record<string, unknown>;
    list = o.events ?? o.items ?? o.body ?? o.data ?? [];
    if (list && typeof list === "object" && !Array.isArray(list)) list = (list as Record<string, unknown>).items ?? [];
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((e) => {
      const o = (e ?? {}) as Record<string, unknown>;
      if (o.status === "cancelled") return null;
      const start = time(o.start);
      const end = time(o.end);
      if (!Number.isFinite(start)) return null;
      return {
        id: String(o.id ?? o.event_id ?? ""),
        start,
        end: Number.isFinite(end) && end > start ? end : start + 30 * 60_000,
        title: String(o.summary ?? o.title ?? ""),
        description: String(o.description ?? ""),
      };
    })
    .filter((e): e is CalEvent => Boolean(e));
}

/** The flow of a business, or NoCalendar. */
export async function requireFlow(db: Db, clientId: string): Promise<string> {
  const url = await flowUrl(db, clientId);
  if (!url) throw new NoCalendar();
  return url;
}

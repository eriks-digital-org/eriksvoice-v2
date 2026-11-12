import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSecret, setClientSecret } from "@/lib/providers/secrets";

/**
 * ERIKSCRM (AgencyES) API, one key per business (docs: "AgencyES × EriksVoice — CRM API",
 * 12.11.2026). The base URL is one for all businesses (Settings → Providers); the key
 * decides which business the calls read and write.
 */

export interface CrmLead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status?: string | null;
  tags?: string[];
  source?: string | null;
  custom_fields?: Record<string, unknown>;
  latest_activity?: { type: string; title: string; description: string; created_at: string } | null;
}

export interface CrmConfig {
  /** A new lead in the CRM is added to the client's leads (and fires "ליד חדש"). */
  import_leads?: boolean;
}

export class CrmError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

const hex = (clientId: string) => clientId.replace(/-/g, "").toLowerCase();
export const keyName = (clientId: string) => `crm_key_${hex(clientId)}`;
export const hookName = (clientId: string) => `crm_hook_${hex(clientId)}`;

export async function crmBaseUrl(): Promise<string | null> {
  return (await getSecret("erikscrm_base_url"))?.replace(/\/+$/, "") || null;
}

/** The client's CRM key, when the CRM is connected for it. */
export async function crmKey(clientId: string): Promise<string | null> {
  return (await getSecret(keyName(clientId))) ?? null;
}

export async function saveCrmKey(clientId: string, key: string) {
  await setClientSecret(keyName(clientId), key);
}

export async function saveCrmHookSecret(clientId: string, secret: string) {
  await setClientSecret(hookName(clientId), secret);
}

export async function crmHookSecret(clientId: string): Promise<string | null> {
  return (await getSecret(hookName(clientId))) ?? null;
}

const MESSAGES: Record<string, string> = {
  invalid_key: "המפתח של ה־CRM לא תקין, בוטל, או שהעסק לא פעיל ב־CRM",
  rate_limited: "יותר מדי קריאות ל־CRM בדקה. ננסה שוב",
  lead_quota: "מכסת הלידים של העסק ב־CRM מלאה",
  invalid_status: "הסטטוס לא קיים ב־CRM של העסק",
  invalid_transition: "ה־CRM לא מאפשר את שינוי הסטטוס הזה",
  unknown_custom_field: "שדה שלא מוגדר ב־CRM",
  lead_not_found: "הליד לא נמצא ב־CRM",
};

/** One API call. Throws CrmError with a Hebrew message. */
export async function crmFetch<T>(
  clientId: string,
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown; idempotencyKey?: string; timeoutMs?: number; key?: string } = {},
): Promise<T> {
  const base = await crmBaseUrl();
  if (!base) throw new CrmError("לא הוגדרה כתובת ה־API של ה־CRM (הגדרות ← ספקים)", 0, "no_base_url");
  const key = init.key ?? (await crmKey(clientId));
  if (!key) throw new CrmError("ללקוח אין מפתח CRM", 0, "no_key");
  const method = init.method ?? "GET";
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      // The document says "Authorization: Bearer"; the CRM's builder also named "x-api-key".
      // Both carry the same key, so either way the function finds it.
      Authorization: `Bearer ${key}`,
      "x-api-key": key,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "Idempotency-Key": init.idempotencyKey ?? crypto.randomUUID() } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    cache: "no-store",
  }).catch((e: unknown) => {
    throw new CrmError(e instanceof Error && e.name === "TimeoutError" ? "ה־CRM לא ענה בזמן" : "אין חיבור ל־CRM", 0, "network");
  });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) throw new CrmError("כתובת ה־CRM מחזירה דף אתר ולא API", res.status, "not_json");
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;
  if (!res.ok) {
    const code = json.error?.code ?? "error";
    throw new CrmError(MESSAGES[code] ?? `ה־CRM החזיר ${res.status}: ${json.error?.message ?? code}`, res.status, code);
  }
  return json;
}

export const findLeads = (clientId: string, phone: string, timeoutMs?: number) =>
  crmFetch<{ leads: CrmLead[] }>(clientId, `/leads?phone=${encodeURIComponent(phone)}`, { timeoutMs }).then((r) => r.leads ?? []);

/** Creates the lead, or updates the existing card with this phone. */
export const upsertLead = (clientId: string, body: Record<string, unknown>, idempotencyKey: string) =>
  crmFetch<{ created: boolean; lead: CrmLead }>(clientId, "/leads", { method: "POST", body, idempotencyKey });

export const updateLead = (clientId: string, id: string, body: Record<string, unknown>, idempotencyKey: string) =>
  crmFetch<{ lead: CrmLead }>(clientId, `/leads/${encodeURIComponent(id)}`, { method: "PATCH", body, idempotencyKey });

export const addActivity = (clientId: string, id: string, body: Record<string, unknown>, idempotencyKey: string) =>
  crmFetch<{ id: string }>(clientId, `/leads/${encodeURIComponent(id)}/activities`, { method: "POST", body, idempotencyKey });

export const addNote = (clientId: string, id: string, note: string, idempotencyKey: string) =>
  crmFetch<{ id: string }>(clientId, `/leads/${encodeURIComponent(id)}/notes`, { method: "POST", body: { note }, idempotencyKey });

export const addTask = (clientId: string, id: string, body: Record<string, unknown>, idempotencyKey: string) =>
  crmFetch<{ id: string }>(clientId, `/leads/${encodeURIComponent(id)}/tasks`, { method: "POST", body, idempotencyKey });

export const statuses = (clientId: string, key?: string) =>
  crmFetch<{ statuses: string[]; process_steps: string[] }>(clientId, "/statuses", { key });

/**
 * The CRM card of a phone number: the oldest match (the CRM keeps new leads on it),
 * or a new card when there is none.
 */
export async function ensureLead(clientId: string, phone: string, name: string, idempotencyKey: string): Promise<CrmLead> {
  const found = await findLeads(clientId, phone);
  if (found[0]) return found[0];
  const r = await upsertLead(clientId, { name: (name || `מתקשר ${phone}`).slice(0, 200), phone, source: "EriksVoice" }, idempotencyKey);
  return r.lead;
}

/** Whether the client has the CRM connected (a saved key). */
export async function crmConnected(clientId: string): Promise<boolean> {
  if (!(await crmBaseUrl())) return false;
  return Boolean(await crmKey(clientId));
}

export async function crmConfig(clientId: string): Promise<CrmConfig> {
  const { data } = await createAdminClient().from("connections").select("config").eq("client_id", clientId).eq("kind", "erikscrm").maybeSingle();
  return ((data as { config?: CrmConfig } | null)?.config ?? {}) as CrmConfig;
}

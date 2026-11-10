import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_FIELDS } from "./registry";

/**
 * Provider keys: the value saved in the admin panel (Supabase Vault) wins, otherwise the
 * Vercel environment variable. Cached for 30 seconds per server instance.
 */
type Entry = { value: string; source: "panel" | "env"; updatedAt: string | null };
let cache: { at: number; map: Map<string, Entry> } | null = null;
const TTL = 30_000;

async function load(): Promise<Map<string, Entry>> {
  if (cache && Date.now() - cache.at < TTL) return cache.map;
  const map = new Map<string, Entry>();
  try {
    const { data, error } = await createAdminClient().rpc("app_secrets_get");
    if (error) throw error;
    for (const r of (data ?? []) as { name: string; secret: string; updated_at: string }[]) {
      if (r.secret) map.set(r.name, { value: r.secret, source: "panel", updatedAt: r.updated_at });
    }
  } catch (e) {
    // Vault not reachable (e.g. migration not applied yet): fall back to the environment.
    console.error("secrets: vault read failed", e);
  }
  for (const f of ALL_FIELDS) {
    const env = process.env[f.env];
    if (!map.has(f.name) && env) map.set(f.name, { value: env, source: "env", updatedAt: null });
  }
  cache = { at: Date.now(), map };
  return map;
}

export async function getSecret(name: string): Promise<string | undefined> {
  return (await load()).get(name)?.value;
}

export type SecretInfo = { source: "panel" | "env"; shown: string; updatedAt: string | null } | null;

/** For the providers screen: where each value comes from; secrets show only their last 4 characters. */
export async function describeSecrets(): Promise<Record<string, SecretInfo>> {
  const map = await load();
  return Object.fromEntries(
    ALL_FIELDS.map((f) => {
      const e = map.get(f.name);
      return [f.name, e ? { source: e.source, shown: f.secret ? `••••${e.value.slice(-4)}` : e.value, updatedAt: e.updatedAt } : null];
    }),
  );
}

export async function setSecret(name: string, value: string, userId: string) {
  if (!ALL_FIELDS.some((f) => f.name === name)) throw new Error("unknown secret");
  const db = createAdminClient();
  const { error } = await db.rpc("app_secret_set", { p_name: name, p_value: value });
  if (error) throw new Error(error.message);
  await db.from("provider_secret_log").insert({ name, action: value ? "set" : "clear", changed_by: userId });
  cache = null;
}

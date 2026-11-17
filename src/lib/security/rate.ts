import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Whether one more request under `key` is allowed: at most `max` per `windowSecs`.
 * Fails open (allows) when the database can't answer, so a hiccup never blocks real leads.
 */
export async function rateOk(key: string, max: number, windowSecs: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("rate_ok", { p_key: key, p_max: max, p_window_secs: windowSecs });
  if (error) {
    console.error("rate limit", error.message);
    return true;
  }
  return data !== false;
}

/** The caller's IP address (behind Vercel's proxy). */
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * The public address from NEXT_PUBLIC_SITE_URL, always https (except localhost).
 * Providers (ElevenLabs tools and webhooks) call it with POST, and an http address only
 * redirects, which they do not follow — so the call never reaches us.
 */
export function publicOrigin(raw = process.env.NEXT_PUBLIC_SITE_URL ?? "https://eriksvoice.co.il"): string {
  const s = raw.trim().replace(/\/+$/, "");
  return /^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(s) ? s : s.replace(/^http:\/\//i, "https://");
}

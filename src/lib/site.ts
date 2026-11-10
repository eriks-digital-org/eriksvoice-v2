import "server-only";
import { headers } from "next/headers";

/** The site's own address, for links in emails (NEXT_PUBLIC_SITE_URL in production). */
export async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

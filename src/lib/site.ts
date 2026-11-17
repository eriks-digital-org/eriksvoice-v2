import "server-only";
import { headers } from "next/headers";
import { publicOrigin } from "@/lib/origin";

/** The site's own address, for links in emails (NEXT_PUBLIC_SITE_URL in production). */
export async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return publicOrigin();
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

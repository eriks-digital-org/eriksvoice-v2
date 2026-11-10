import "server-only";
import { getSecret } from "@/lib/providers/secrets";

const FROM = "EriksVoice <noreply@eriksvoice.co.il>";

/** Sends one email through Utobo. Never throws: a failed email must not break the action behind it. */
export async function sendMail(to: string[], subject: string, text: string, link?: string): Promise<boolean> {
  const key = await getSecret("utobo_api_key");
  const list = [...new Set(to.map((t) => t.trim()).filter((t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)))];
  if (!key || !list.length) return false;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://eriksvoice.co.il";
  const url = link ? new URL(link, site).toString() : null;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#1d1b26">
<p>${esc(text).replace(/\n/g, "<br>")}</p>${url ? `<p><a href="${esc(url)}" style="color:#7b4fe6">לפרטים במערכת</a></p>` : ""}
<p style="color:#8a8797;font-size:13px">EriksVoice</p></div>`;
  try {
    const res = await fetch("https://api.email.utobo.com/v1/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: list, subject, html, text: url ? `${text}\n\n${url}` : text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error("utobo", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("utobo", e);
    return false;
  }
}

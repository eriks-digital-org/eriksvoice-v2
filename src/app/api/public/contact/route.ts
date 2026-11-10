import { NextResponse } from "next/server";
import { notify } from "@/lib/notify";
import { toE164 } from "@/lib/phone";

const TOPICS: Record<string, string> = {
  campaigns: "קמפיינים ממומנים",
  creative: "קריאייטיב",
  ai: "הטמעות AI",
  agents: "סוכני AI",
  unsure: "עוד לא בטוחים",
};

/** The landing page's "contact us" form: a notification (and email) to the admin. */
export async function POST(req: Request) {
  let d: Record<string, unknown>;
  try {
    d = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const s = (k: string, max: number) => (typeof d[k] === "string" ? (d[k] as string).trim().slice(0, max) : "");
  // A hidden field people don't see; bots fill it.
  if (s("website", 200)) return NextResponse.json({ ok: true });
  const name = s("name", 120);
  const phoneRaw = s("phone", 40);
  if (!name || !phoneRaw) return NextResponse.json({ error: "missing" }, { status: 400 });
  const phone = toE164(phoneRaw) ?? phoneRaw;
  const topics = (Array.isArray(d.topics) ? d.topics : []).map((t) => TOPICS[String(t)]).filter(Boolean);
  const lines = [
    `טלפון: ${phone}`,
    s("email", 200) && `אימייל: ${s("email", 200)}`,
    s("business", 160) && `עסק: ${s("business", 160)}`,
    topics.length ? `במה לעזור: ${topics.join(", ")}` : "",
    s("message", 2000) && `הודעה: ${s("message", 2000)}`,
  ].filter(Boolean);
  try {
    await notify({ clientId: null, kind: "contact", title: `פנייה חדשה מהאתר: ${name}`, body: lines.join("\n"), link: "/admin/notifications", email: true });
  } catch (e) {
    console.error("contact form", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

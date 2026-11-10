import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/automations/engine";
import { emitNewLeads } from "@/lib/automations/leads";
import { toE164 } from "@/lib/phone";

/**
 * A client's incoming webhook: https://eriksvoice.co.il/api/public/hooks/<token>.
 * JSON or form data. With a phone number it also adds (or finds) a lead.
 * Fires "webhook_in" (and "lead_new" for a new lead).
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const db = createAdminClient();
  const { data: client } = await db.from("clients").select("id").eq("inbound_token", token).maybeSingle();
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });

  let data: Record<string, unknown> = {};
  const raw = await req.text();
  if (raw.length > 100_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  try {
    data = (req.headers.get("content-type") ?? "").includes("application/json")
      ? (JSON.parse(raw) as Record<string, unknown>)
      : Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = data[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return "";
  };
  const name = pick("name", "full_name", "fullName", "שם");
  const phone = toE164(pick("phone", "mobile", "tel", "phone_number", "טלפון"));
  const email = pick("email", "mail", "מייל");
  const event = pick("event", "type");
  const key = pick("id", "event_id") || createHash("sha256").update(raw).digest("hex").slice(0, 32);

  let leadId: string | undefined;
  let tags: string[] = [];
  if (phone) {
    const { data: existing } = await db.from("leads").select("id, tags").eq("client_id", client.id).eq("phone", phone).maybeSingle();
    if (existing) {
      leadId = existing.id;
      tags = existing.tags as string[];
    } else {
      const tag = pick("tag", "folder", "list");
      const { data: lead } = await db
        .from("leads")
        .insert({ client_id: client.id, name: name.slice(0, 120), phone, email: email.slice(0, 200), source: "webform", tags: tag ? [tag] : [] })
        .select("id, tags")
        .single();
      if (lead) {
        leadId = lead.id;
        tags = lead.tags as string[];
        await emitNewLeads([lead.id]);
      }
    }
  }
  await emit({
    type: "webhook_in",
    clientId: client.id,
    key: `hook:${key}`,
    name: event,
    data,
    contact: { name, phone: phone ?? "", email, leadId },
    lead: leadId ? { id: leadId, tags } : undefined,
  });
  return NextResponse.json({ ok: true });
}

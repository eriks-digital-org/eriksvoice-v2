import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/automations/engine";
import { emitNewLeads } from "@/lib/automations/leads";
import { crmConfig, crmHookSecret } from "@/lib/crm/erikscrm";
import { toE164 } from "@/lib/phone";

type CrmEvent = {
  id?: string;
  event?: string;
  lead?: { id?: string; name?: string; phone?: string; email?: string | null; status?: string | null; tags?: string[] | null; source?: string | null };
  previous_status?: string | null;
};

/**
 * Events from ERIKSCRM for one client: https://eriksvoice.co.il/api/public/crm/<client token>.
 * Signed with X-Signature = hex HMAC-SHA256(secret, raw body); X-Event-ID is the same on every retry.
 * - lead.created: the lead is added to the client's leads and fires "ליד חדש" (unless it came from us).
 * - lead.status_changed: fires "סטטוס השתנה ב־CRM".
 * - lead.updated: name / email / tags of the matching lead are refreshed.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const db = createAdminClient();
  const { data: client } = await db.from("clients").select("id").eq("inbound_token", token).maybeSingle();
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });
  const clientId = client.id as string;

  const raw = await req.text();
  if (raw.length > 300_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  const secret = await crmHookSecret(clientId);
  const given = (req.headers.get("x-signature") ?? "").toLowerCase();
  const expected = secret ? createHmac("sha256", secret).update(raw).digest("hex") : "";
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let e: CrmEvent;
  try {
    e = JSON.parse(raw) as CrmEvent;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const delivery = (req.headers.get("x-event-id") ?? e.id ?? "").slice(0, 100);
  if (!delivery || !e.event) return NextResponse.json({ error: "bad body" }, { status: 400 });

  // Each delivery once.
  const { error: dup } = await db.from("crm_deliveries").insert({ client_id: clientId, delivery_id: delivery, event: e.event });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  try {
    await handle(clientId, e);
  } catch (err) {
    console.error("crm webhook", err);
    await db.from("crm_deliveries").delete().eq("client_id", clientId).eq("delivery_id", delivery);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

async function handle(clientId: string, e: CrmEvent) {
  const l = e.lead;
  if (!l?.id) return;
  const db = createAdminClient();
  const phone = toE164(l.phone ?? "");
  const tags = (l.tags ?? []).filter((t) => typeof t === "string").slice(0, 20);

  // Our lead for this CRM card: by link, then by phone.
  let { data: local } = await db.from("leads").select("id, tags").eq("client_id", clientId).eq("crm_id", l.id).maybeSingle();
  if (!local && phone) {
    ({ data: local } = await db.from("leads").select("id, tags").eq("client_id", clientId).eq("phone", phone).maybeSingle());
    if (local) await db.from("leads").update({ crm_id: l.id }).eq("id", local.id);
  }

  if (e.event === "lead.created") {
    if (local || !phone) return;
    const config = await crmConfig(clientId);
    if (config.import_leads === false) return;
    const { data: lead, error } = await db
      .from("leads")
      .insert({ client_id: clientId, name: (l.name ?? "").slice(0, 120), phone, email: (l.email ?? "").slice(0, 200), source: "crm", crm_id: l.id, tags })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // A lead our own agents created in the CRM is not "new" again.
    if (l.source !== "EriksVoice") await emitNewLeads([lead.id as string]);
    return;
  }

  if (e.event === "lead.updated" && local) {
    await db
      .from("leads")
      .update({ ...(l.name ? { name: l.name.slice(0, 120) } : {}), ...(l.email ? { email: l.email.slice(0, 200) } : {}), tags })
      .eq("id", local.id);
    return;
  }

  if (e.event === "lead.status_changed") {
    await emit({
      type: "crm_status",
      clientId,
      key: `crm:${e.id ?? `${l.id}:${l.status}`}`,
      contact: { name: l.name ?? "", phone: phone ?? "", email: l.email ?? "", leadId: local?.id },
      lead: local ? { id: local.id, tags: (local.tags as string[]) ?? [] } : undefined,
      crm: { leadId: l.id, status: l.status ?? "", previousStatus: e.previous_status ?? "" },
    });
  }
}

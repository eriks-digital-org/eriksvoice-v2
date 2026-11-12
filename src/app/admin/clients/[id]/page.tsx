import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { StatTile } from "@/components/ds/kit";
import { ClientStatusBadge } from "@/components/ds/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentRow, ClientRow, PhoneRow } from "@/lib/data/types";
import { DeleteClientForm, InviteForm } from "./ClientForms";
import { connectionStatusAction, flowUrlAction, resyncAction, setStatusAction } from "./actions";
import { CONNECTIONS } from "@/lib/connections";
import { ConnBadge, type ConnStatus } from "@/components/ds/StatusBadge";
import { AgentAdminCard } from "./AgentAdminCard";
import { loadCatalog } from "@/lib/voice/catalog";
import { isTwilioConfigured, listOwnedNumbers, type OwnedNumber } from "@/lib/telephony/twilio";
import { NumbersPanel } from "./NumbersPanel";
import { CrmPanel } from "./CrmPanel";
import { crmBaseUrl, crmHookSecret, crmKey, type CrmConfig } from "@/lib/crm/erikscrm";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const { data: client } = await db.from("clients").select("*").eq("id", id).maybeSingle<ClientRow>();
  if (!client) notFound();

  const [{ data: agents }, { data: phones }, { data: members }, { count: knowledgeCount }, { count: connected }, { data: flow }] = await Promise.all([
    db.from("agents").select("id, client_id, type_key, name, status, voice_id, opening_line, sync_status, sync_error, llm_model_override, realtime_model_override, custom_prompt, provider_agent_id").eq("client_id", id).order("created_at"),
    db.from("phone_numbers").select("id, client_id, e164, agent_id, is_primary, label, route_error, provider_phone_id").order("created_at").eq("client_id", id),
    db.from("client_members").select("user_id, created_at, profiles:user_id(email, full_name)").eq("client_id", id),
    db.from("knowledge_items").select("id", { count: "exact", head: true }).eq("client_id", id),
    db.from("connections").select("id", { count: "exact", head: true }).eq("client_id", id).eq("status", "connected"),
    db.from("connections").select("flow_url").eq("client_id", id).eq("kind", "activepieces").maybeSingle(),
  ]);
  const [{ data: conns }, crmBase, crmKeySaved, crmHook] = await Promise.all([
    db.from("connections").select("kind, status, last_error, requested_at, config").eq("client_id", id),
    crmBaseUrl(),
    crmKey(id),
    crmHookSecret(id),
  ]);
  const connOf = (kind: string) => (conns ?? []).find((c) => c.kind === kind) as { status: ConnStatus; last_error: string | null; requested_at: string | null } | undefined;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://eriksvoice.co.il";
  const agentList = (agents ?? []) as AgentRow[];
  const phoneList = (phones ?? []) as PhoneRow[];
  const [catalog, { owned, ownedError }] = await Promise.all([loadCatalog(), loadOwnedNumbers()]);
  type Member = { user_id: string; profiles: { email: string; full_name: string } | null };
  const memberList = (members ?? []) as unknown as Member[];

  const readiness = [
    { label: "פרטי העסק ותיאור", done: Boolean(client.description) },
    { label: "משתמש לקוח הוזמן", done: memberList.length > 0 },
    { label: "מידע במאגר הידע", done: (knowledgeCount ?? 0) > 0 },
    { label: "מספר טלפון", done: phoneList.length > 0 },
    { label: "חיבור אחד לפחות", done: (connected ?? 0) > 0 },
    { label: "סוכן פעיל", done: agentList.some((a) => a.status === "active") },
  ];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title={client.name}
        description={[client.industry, client.address].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <ClientStatusBadge status={client.status} />
            <Link href={`/admin/clients/${client.id}/edit`} className="min-h-11 rounded-full bg-card px-4 py-2.5 text-[15px] font-medium text-ink shadow-soft">
              עריכת פרטים
            </Link>
            <form action={setStatusAction} className="flex gap-2">
              <input type="hidden" name="client_id" value={client.id} />
              {client.status !== "active" && (
                <button name="status" value="active" className="min-h-11 rounded-full bg-ink px-4 text-[15px] font-medium text-white">
                  {client.status === "paused" ? "הפעלה מחדש" : "הפעלת הלקוח"}
                </button>
              )}
              {client.status !== "paused" && (
                <button
                  name="status"
                  value="paused"
                  title="המספרים מפסיקים לענות, והחיוג והאוטומציות נעצרים. הכל חוזר בהפעלה מחדש."
                  className="min-h-11 rounded-full bg-card px-4 text-[15px] font-medium text-ink shadow-soft"
                >
                  השהיה
                </button>
              )}
            </form>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="כתובת הפורטל" value={<span className="text-[20px]">/{client.slug}</span>} />
        <StatTile label="מכסת דקות" value={client.monthly_minutes.toLocaleString()} />
        <StatTile label="סוכנים" value={agentList.length} hint={`${agentList.filter((a) => a.status === "active").length} פעילים`} />
        <StatTile label="מספרים" value={phoneList.length} />
      </div>

      <Panel title="מה חסר כדי להתחיל">
        <ul className="grid gap-2 sm:grid-cols-2">
          {readiness.map((r) => (
            <li key={r.label} className="flex min-h-11 items-center gap-3 text-[16px]">
              {r.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-ink-soft" />}
              <span className={r.done ? "text-ink-muted line-through" : "text-ink"}>{r.label}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="סוכנים"
        subtitle="סוכן כבוי נשמר רק אצלנו. ההפעלה יוצרת אותו בשירות הקול, וכל שינוי עולה אליו מיד."
        action={
          <form action={resyncAction}>
            <input type="hidden" name="client_id" value={client.id} />
            <button className="min-h-10 rounded-full bg-card px-4 text-[14px] font-medium text-ink shadow-soft">סנכרון מחדש</button>
          </form>
        }
      >
        <ul className="grid gap-3 lg:grid-cols-2">
          {agentList.map((a) => (
            <AgentAdminCard key={a.id} agent={a} voices={catalog.voices.filter((v) => v.source === "account")} llms={catalog.llms} />
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="מספרים וניתוב" subtitle="כל מספר עונה עם סוכן אחד. סוכן בלי מספר משלו מתקשר החוצה מהמספר הראשי.">
          <NumbersPanel
            clientId={client.id}
            phones={phoneList}
            agents={agentList.map((a) => ({ id: a.id, name: a.name, active: a.status === "active" }))}
            owned={owned.map(({ sid, number, friendly }) => ({ sid, number, friendly }))}
            ownedError={ownedError}
          />
        </Panel>

        <Panel title="משתמשים והזמנות">
          <ul className="mb-4 divide-y divide-border">
            {memberList.map((m) => (
              <li key={m.user_id} className="flex min-h-12 items-center justify-between gap-3 text-[16px]">
                <span className="truncate text-ink">{m.profiles?.full_name || m.profiles?.email}</span>
                <span dir="ltr" className="truncate text-[14px] text-ink-muted">
                  {m.profiles?.email}
                </span>
              </li>
            ))}
            {memberList.length === 0 && <li className="py-2 text-[16px] text-ink-muted">עוד אין משתמשים ללקוח.</li>}
          </ul>
          <InviteForm clientId={client.id} />
        </Panel>
      </div>

      <Panel title="אוטומציות וחיבורים" subtitle="הזרימה של הלקוח ב־Activepieces מקבלת את הפעולה 'Activepieces' מהאוטומציות שלו.">
        <form action={flowUrlAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="client_id" value={client.id} />
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[15px] font-medium text-ink">כתובת ה־Webhook של הזרימה ב־Activepieces</span>
            <input
              name="flow_url"
              type="url"
              dir="ltr"
              defaultValue={(flow as { flow_url?: string | null } | null)?.flow_url ?? ""}
              placeholder="https://voice.eriks.co.il/api/v1/webhooks/…"
              className="h-12 w-full rounded-2xl border border-input bg-card px-3 text-[16px]"
            />
          </label>
          <button className="min-h-12 rounded-full bg-ink px-5 text-[15px] font-medium text-white">שמירה</button>
        </form>
        <p className="mt-5 text-[15px] font-medium text-ink">כתובת לקבלת נתונים אצל הלקוח (טפסים, Activepieces, CRM)</p>
        <code dir="ltr" className="mt-1.5 block break-all rounded-2xl bg-muted/60 p-3 text-[14px] text-ink">
          {site}/api/public/hooks/{(client as ClientRow & { inbound_token?: string }).inbound_token}
        </code>
      </Panel>

      <Panel title="חיבורי הלקוח" subtitle="אחרי שמחברים את השירות ב־Activepieces ובודקים, מסמנים כאן ״מחובר״. הלקוח רואה את הסטטוס.">
        <ul className="divide-y divide-border">
          {CONNECTIONS.filter((c) => !c.later && c.kind !== "erikscrm").map((c) => {
            const cur = connOf(c.kind);
            const st = cur?.status ?? "off";
            return (
              <li key={c.kind} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium text-ink">{c.label}</span>
                  {cur?.last_error && <span className="block text-[13px] text-destructive">{cur.last_error}</span>}
                </span>
                <ConnBadge status={st} />
                <form action={connectionStatusAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="client_id" value={client.id} />
                  <input type="hidden" name="kind" value={c.kind} />
                  <select name="status" defaultValue={st} className="h-10 rounded-xl border border-input bg-card px-2 text-[14px]">
                    <option value="off">לא מחובר</option>
                    <option value="requested">נשלחה בקשה</option>
                    <option value="configured">בבדיקה</option>
                    <option value="connected">מחובר</option>
                    <option value="error">תקלה</option>
                  </select>
                  <input name="note" placeholder="הערה לתקלה" defaultValue={cur?.last_error ?? ""} className="h-10 w-36 rounded-xl border border-input bg-card px-2 text-[14px]" />
                  <button className="min-h-10 rounded-full bg-ink px-4 text-[14px] font-medium text-white">עדכון</button>
                </form>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="ERIKSCRM" subtitle="זיהוי מתקשר מה־CRM, רישום שיחות, עדכון לידים מהאוטומציות, ולידים חדשים מה־CRM.">
        <CrmPanel
          clientId={client.id}
          baseUrlSet={Boolean(crmBase)}
          hasKey={Boolean(crmKeySaved)}
          hasHookSecret={Boolean(crmHook)}
          hookUrl={`${site}/api/public/crm/${(client as ClientRow & { inbound_token?: string }).inbound_token}`}
          importLeads={((conns ?? []).find((c) => c.kind === "erikscrm")?.config as CrmConfig | undefined)?.import_leads !== false}
        />
      </Panel>

      <Panel title="אזור מסוכן">
        <DeleteClientForm clientId={client.id} name={client.name} />
      </Panel>
    </div>
  );
}

/** Twilio's voice numbers for the numbers panel, or why they couldn't be loaded. */
async function loadOwnedNumbers(): Promise<{ owned: OwnedNumber[]; ownedError?: string }> {
  if (!(await isTwilioConfigured())) return { owned: [], ownedError: "Twilio עוד לא מחובר, אפשר להקליד מספר ידנית." };
  try {
    return { owned: (await listOwnedNumbers()).filter((n) => n.voice) };
  } catch (e) {
    return { owned: [], ownedError: e instanceof Error ? e.message : "לא הצלחנו לטעון מספרים מ־Twilio" };
  }
}

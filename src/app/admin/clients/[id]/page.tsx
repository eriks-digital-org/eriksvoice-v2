import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { StatTile } from "@/components/ds/kit";
import { ClientStatusBadge } from "@/components/ds/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentRow, ClientRow, PhoneRow } from "@/lib/data/types";
import { DeleteClientForm, InviteForm } from "./ClientForms";
import { resyncAction, setStatusAction } from "./actions";
import { AgentAdminCard } from "./AgentAdminCard";
import { loadCatalog } from "@/lib/voice/catalog";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const { data: client } = await db.from("clients").select("*").eq("id", id).maybeSingle<ClientRow>();
  if (!client) notFound();

  const [{ data: agents }, { data: phones }, { data: members }, { count: knowledgeCount }, { count: connected }] = await Promise.all([
    db.from("agents").select("id, client_id, type_key, name, status, voice_id, opening_line, sync_status, sync_error, llm_model_override, custom_prompt, provider_agent_id").eq("client_id", id).order("created_at"),
    db.from("phone_numbers").select("id, client_id, e164, agent_id, is_primary, label").eq("client_id", id),
    db.from("client_members").select("user_id, created_at, profiles:user_id(email, full_name)").eq("client_id", id),
    db.from("knowledge_items").select("id", { count: "exact", head: true }).eq("client_id", id),
    db.from("connections").select("id", { count: "exact", head: true }).eq("client_id", id).eq("status", "connected"),
  ]);
  const agentList = (agents ?? []) as AgentRow[];
  const catalog = await loadCatalog();
  const phoneList = (phones ?? []) as PhoneRow[];
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
            <form action={setStatusAction} className="flex gap-2">
              <input type="hidden" name="client_id" value={client.id} />
              {client.status !== "paused" ? (
                <button name="status" value="paused" className="min-h-11 rounded-full bg-card px-4 text-[15px] font-medium text-ink shadow-soft">
                  השהיה
                </button>
              ) : (
                <button name="status" value="active" className="min-h-11 rounded-full bg-card px-4 text-[15px] font-medium text-ink shadow-soft">
                  הפעלה מחדש
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
            <AgentAdminCard key={a.id} agent={a} voices={catalog.voices} llms={catalog.llms} />
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="מספרים וניתוב">
          {phoneList.length === 0 ? (
            <p className="text-[16px] text-ink-muted">אין עדיין מספר. מספרים נקנים ב־Twilio ומוקצים לעסק אחד בלבד.</p>
          ) : (
            <ul className="divide-y divide-border">
              {phoneList.map((p) => (
                <li key={p.id} className="flex min-h-14 items-center justify-between gap-3">
                  <span className="num text-[17px] text-ink">{p.e164}</span>
                  <span className="text-[14px] text-ink-muted">
                    {p.is_primary ? "ראשי · " : ""}
                    {agentList.find((a) => a.id === p.agent_id)?.name ?? "לא משויך לסוכן"}
                  </span>
                </li>
              ))}
            </ul>
          )}
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

      <Panel title="אזור מסוכן">
        <DeleteClientForm clientId={client.id} name={client.name} />
      </Panel>
    </div>
  );
}

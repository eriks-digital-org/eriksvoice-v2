import { notFound } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { PageHeader, Panel } from "@/components/ds/primitives";
import { StatTile } from "@/components/ds/kit";
import { AgentStatusBadge, ClientStatusBadge } from "@/components/ds/StatusBadge";
import { characterForType } from "@/components/agents/characters";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { agentTypeLabels } from "@/lib/agent-types";
import type { AgentRow, ClientRow, PhoneRow } from "@/lib/data/types";
import { DeleteClientForm, InviteForm } from "./ClientForms";
import { setStatusAction } from "./actions";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const { data: client } = await db.from("clients").select("*").eq("id", id).maybeSingle<ClientRow>();
  if (!client) notFound();

  const [{ data: agents }, { data: phones }, { data: members }, { count: knowledgeCount }, { count: connected }] = await Promise.all([
    db.from("agents").select("id, client_id, type_key, name, status, voice_id, opening_line, sync_status").eq("client_id", id).order("created_at"),
    db.from("phone_numbers").select("id, client_id, e164, agent_id, is_primary, label").eq("client_id", id),
    db.from("client_members").select("user_id, created_at, profiles:user_id(email, full_name)").eq("client_id", id),
    db.from("knowledge_items").select("id", { count: "exact", head: true }).eq("client_id", id),
    db.from("connections").select("id", { count: "exact", head: true }).eq("client_id", id).eq("status", "connected"),
  ]);
  const agentList = (agents ?? []) as AgentRow[];
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

      <Panel title="סוכנים" subtitle="הסוכנים נשמרים רק אצלנו עד שמפעילים אותם. ההפעלה יוצרת את הסוכן בשירות הקול, ותיפתח אחרי חיבור ElevenLabs.">
        <ul className="grid gap-3 sm:grid-cols-2">
          {agentList.map((a) => {
            const c = characterForType(a.type_key, a.id);
            return (
              <li key={a.id} className="flex items-center gap-4 rounded-[22px] bg-muted/60 p-3">
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: c.wash }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.smile} alt="" className="size-14 object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-medium text-ink">{a.name}</span>
                  <span className="block text-[14px] text-ink-muted">{agentTypeLabels[a.type_key]}</span>
                </span>
                <AgentStatusBadge status={a.status} />
              </li>
            );
          })}
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

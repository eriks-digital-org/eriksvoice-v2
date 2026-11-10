"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import type { PhoneRow } from "@/lib/data/types";
import { addNumberAction, removeNumberAction, testCallAction, updateNumberAction, type ActionState } from "./actions";

type AgentOption = { id: string; name: string; active: boolean };
type Owned = { sid: string; number: string; friendly: string };

const selectCls = "h-11 rounded-2xl border border-border bg-card px-3 text-[15px] text-ink";

function Msg({ state }: { state: ActionState }) {
  if (state.error) return <p className="text-[14px] text-destructive">{state.error}</p>;
  if (state.ok) return <p className="text-[14px] text-success">{state.ok}</p>;
  return null;
}

function AgentSelect({ agents, value }: { agents: AgentOption[]; value?: string | null }) {
  return (
    <select name="agent_id" defaultValue={value ?? ""} className={selectCls}>
      <option value="">בלי סוכן (לא עונה)</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
          {a.active ? "" : " (כבוי)"}
        </option>
      ))}
    </select>
  );
}

function NumberRow({ phone, agents }: { phone: PhoneRow; agents: AgentOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateNumberAction, {});
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <span dir="ltr" className="num text-[17px] text-ink">
          {phone.e164}
        </span>
        <span className="text-[13px] text-ink-muted">
          {phone.is_primary ? "ראשי · " : ""}
          {phone.provider_phone_id ? "מחובר לשירות הקול" : "עוד לא מחובר"}
        </span>
      </div>
      {phone.route_error && <p className="text-[13px] text-destructive">שגיאת ניתוב: {phone.route_error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="phone_id" value={phone.id} />
          <AgentSelect agents={agents} value={phone.agent_id} />
          {!phone.is_primary && (
            <label className="flex min-h-11 items-center gap-2 text-[14px] text-ink-muted">
              <input type="checkbox" name="is_primary" value="1" className="size-4" />
              ראשי
            </label>
          )}
          <button disabled={pending} className="min-h-11 rounded-full bg-card px-4 text-[14px] font-medium text-ink shadow-soft disabled:opacity-60">
            {pending ? "שומר…" : "שמירה"}
          </button>
        </form>
        <form action={removeNumberAction}>
          <input type="hidden" name="phone_id" value={phone.id} />
          <button className="min-h-11 rounded-full px-4 text-[14px] font-medium text-destructive">הסרה</button>
        </form>
      </div>
      <Msg state={state} />
    </li>
  );
}

function AddNumberForm({ clientId, agents, owned, ownedError }: { clientId: string; agents: AgentOption[]; owned: Owned[]; ownedError?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addNumberAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 rounded-2xl bg-tint p-3">
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-[14px] font-medium text-ink">הוספת מספר</p>
      {owned.length > 0 ? (
        <select
          name="e164"
          required
          className={selectCls}
          onChange={(e) => {
            const sid = e.currentTarget.form?.elements.namedItem("sid") as HTMLInputElement | null;
            if (sid) sid.value = e.currentTarget.selectedOptions[0]?.dataset.sid ?? "";
          }}
        >
          <option value="">בחירת מספר מ־Twilio</option>
          {owned.map((o) => (
            <option key={o.sid} value={o.number} data-sid={o.sid}>
              {o.number} {o.friendly && o.friendly !== o.number ? `· ${o.friendly}` : ""}
            </option>
          ))}
        </select>
      ) : (
        <Input name="e164" dir="ltr" required placeholder="+972501234567" className="h-11 rounded-2xl text-end text-[16px]" />
      )}
      <input type="hidden" name="sid" defaultValue="" />
      {ownedError && <p className="text-[13px] text-ink-muted">{ownedError}</p>}
      <div className="flex flex-wrap gap-2">
        <AgentSelect agents={agents} />
        <button disabled={pending} className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-60">
          {pending ? "מוסיף…" : "הוספה"}
        </button>
      </div>
      <Msg state={state} />
    </form>
  );
}

function TestCallForm({ agents }: { agents: AgentOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(testCallAction, {});
  const active = agents.filter((a) => a.active);
  return (
    <form action={action} className="flex flex-col gap-2">
      <p className="text-[14px] font-medium text-ink">שיחת ניסיון</p>
      {active.length === 0 ? (
        <p className="text-[14px] text-ink-muted">צריך סוכן פעיל כדי לבצע שיחת ניסיון.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select name="agent_id" className={selectCls}>
            {active.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Input name="to" dir="ltr" required placeholder="+972501234567" className="h-11 flex-1 rounded-2xl text-end text-[16px]" />
          <button disabled={pending} className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-60">
            {pending ? "מתקשר…" : "התקשרו אליי"}
          </button>
        </div>
      )}
      <Msg state={state} />
    </form>
  );
}

export function NumbersPanel(props: { clientId: string; phones: PhoneRow[]; agents: AgentOption[]; owned: Owned[]; ownedError?: string }) {
  const taken = new Set(props.phones.map((p) => p.e164));
  const owned = props.owned.filter((o) => !taken.has(o.number));
  return (
    <div className="flex flex-col gap-4">
      {props.phones.length === 0 ? (
        <p className="text-[16px] text-ink-muted">אין עדיין מספר. מספרים נקנים ב־Twilio ומוקצים לעסק אחד בלבד.</p>
      ) : (
        <ul className="divide-y divide-border">
          {props.phones.map((p) => (
            <NumberRow key={p.id} phone={p} agents={props.agents} />
          ))}
        </ul>
      )}
      <AddNumberForm clientId={props.clientId} agents={props.agents} owned={owned} ownedError={props.ownedError} />
      <TestCallForm agents={props.agents} />
    </div>
  );
}

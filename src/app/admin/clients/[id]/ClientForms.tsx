"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { deleteClientAction, inviteAction, memberAction, type ActionState } from "./actions";

export function InviteForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <input type="hidden" name="client_id" value={clientId} />
      <Input name="full_name" required minLength={2} placeholder="שם מלא" className="h-12 flex-1 rounded-2xl text-[16px]" />
      <Input name="email" type="email" dir="ltr" required placeholder="name@business.co.il" className="h-12 flex-1 rounded-2xl text-end text-[16px]" />
      <button disabled={pending} className="min-h-12 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-60">
        {pending ? "יוצר…" : "יצירת משתמש ושליחת סיסמה"}
      </button>
      <Result state={state} />
    </form>
  );
}

function Result({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && <p className="text-[14px] text-destructive sm:self-center">{state.error}</p>}
      {state.ok && <p className="text-[14px] text-success sm:self-center">{state.ok}</p>}
      {state.password && (
        <code dir="ltr" className="select-all rounded-xl bg-muted px-3 py-2 text-[15px] text-ink sm:self-center">
          {state.password}
        </code>
      )}
    </>
  );
}

/** One user of the client: new temporary password, remove from this client, or delete the account. */
export function MemberRow({ clientId, userId, name, email }: { clientId: string; userId: string; name: string; email: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(memberAction, {});
  const [confirm, setConfirm] = useState<"remove" | "delete" | null>(null);
  const [editing, setEditing] = useState(!name);
  const btn = "min-h-10 rounded-full bg-muted px-3 text-[14px] font-medium text-ink disabled:opacity-60";
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 text-[16px]">
        <span className="min-w-0 truncate text-ink">{name || <span className="text-warning">בלי שם</span>}</span>
        <span dir="ltr" className="truncate text-[14px] text-ink-muted">{email}</span>
      </div>
      {editing && (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="user_id" value={userId} />
          <Input name="full_name" required minLength={2} defaultValue={name} placeholder="שם מלא" className="h-10 min-w-0 flex-1 rounded-xl text-[15px]" />
          <button name="op" value="rename" disabled={pending} className={btn} onClick={() => setTimeout(() => setEditing(false))}>שמירת שם</button>
        </form>
      )}
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="user_id" value={userId} />
        {!editing && <button type="button" className={btn} onClick={() => setEditing(true)}>שינוי שם</button>}
        <button name="op" value="reset" disabled={pending} className={btn}>איפוס סיסמה</button>
        {confirm ? (
          <>
            <button name="op" value={confirm} disabled={pending} className="min-h-10 rounded-full bg-destructive px-3 text-[14px] font-medium text-white" onClick={() => setTimeout(() => setConfirm(null))}>
              {confirm === "remove" ? "לאשר הסרה מהלקוח" : "לאשר מחיקה מלאה"}
            </button>
            <button type="button" className={btn} onClick={() => setConfirm(null)}>ביטול</button>
          </>
        ) : (
          <>
            <button type="button" className={btn} onClick={() => setConfirm("remove")}>הסרה מהלקוח</button>
            <button type="button" className={`${btn} text-destructive`} onClick={() => setConfirm("delete")}>מחיקת המשתמש</button>
          </>
        )}
        <Result state={state} />
      </form>
    </li>
  );
}

export function DeleteClientForm({ clientId, name }: { clientId: string; name: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteClientAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-[15px] text-ink-muted">
        מחיקה מלאה של הלקוח, הסוכנים, הידע, המספרים והשיוכים. כדי לאשר, הקלידו את שם הלקוח: <b className="text-ink">{name}</b>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="confirm" required autoComplete="off" className="h-12 flex-1 rounded-2xl text-[16px]" />
        <button disabled={pending} className="min-h-12 rounded-full bg-destructive px-5 text-[15px] font-medium text-white disabled:opacity-60">
          מחיקת הלקוח
        </button>
      </div>
      {state.error && <p className="text-[14px] text-destructive">{state.error}</p>}
    </form>
  );
}

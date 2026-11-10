"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { deleteClientAction, inviteAction, type ActionState } from "./actions";

export function InviteForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="client_id" value={clientId} />
      <Input name="email" type="email" dir="ltr" required placeholder="name@business.co.il" className="h-12 flex-1 rounded-2xl text-end text-[16px]" />
      <button disabled={pending} className="min-h-12 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-60">
        {pending ? "שולח…" : "הזמנה במייל"}
      </button>
      {state.error && <p className="text-[14px] text-destructive sm:self-center">{state.error}</p>}
      {state.ok && <p className="text-[14px] text-success sm:self-center">{state.ok}</p>}
    </form>
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

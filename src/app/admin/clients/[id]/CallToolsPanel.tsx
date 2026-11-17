"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { CALL_TOOLS } from "@/lib/calltools/definitions";
import { saveCallToolsAction, type ToolsState } from "./tools-actions";

/** Admin: the in-call tools of one business. */
export function CallToolsPanel({
  clientId,
  enabled,
  meetingMinutes,
  meetingInvite,
  transferPhone,
}: {
  clientId: string;
  enabled: string[];
  meetingMinutes: number;
  meetingInvite: boolean;
  transferPhone: string;
}) {
  const [state, action, pending] = useActionState<ToolsState, FormData>(saveCallToolsAction, {});
  const on = new Set(enabled);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="client_id" value={clientId} />
      <ul className="grid gap-2 sm:grid-cols-2">
        {CALL_TOOLS.map((t) => (
          <li key={t.name}>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-muted/60 p-3">
              <input type="checkbox" name={`tool_${t.name}`} defaultChecked={on.has(t.name)} className="mt-1 size-4 accent-[var(--violet)]" />
              <span className="min-w-0">
                <span className="block text-[16px] font-medium text-ink">{t.label}</span>
                <span className="block text-[13px] text-ink-muted">{t.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[14px] text-ink-muted">
          אורך פגישה (דקות)
          <Input name="meeting_minutes" type="number" min={5} max={480} defaultValue={meetingMinutes} dir="ltr" className="h-12 rounded-2xl text-end text-[16px]" />
        </label>
        <label className="flex flex-col gap-1 text-[14px] text-ink-muted">
          מספר להעברה לנציג אנושי
          <Input name="transfer_phone" defaultValue={transferPhone} dir="ltr" placeholder="050…" className="h-12 rounded-2xl text-end text-[16px]" />
        </label>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-muted/60 p-3">
        <input type="checkbox" name="meeting_invite" defaultChecked={meetingInvite} className="mt-1 size-4 accent-[var(--violet)]" />
        <span className="min-w-0">
          <span className="block text-[16px] font-medium text-ink">הזמנה מיומן גוגל ללקוח</span>
          <span className="block text-[13px] text-ink-muted">כשהלקוח מסר מייל, גוגל שולח לו הזמנה לפגישה מהחשבון של העסק, והיא נכנסת ליומן שלו</span>
        </span>
      </label>
      <p className="text-[14px] text-ink-muted">
        הפגישות נבדקות ונקבעות ביומן גוגל של העסק דרך ה־flow שלו ב־Activepieces (חובה להגדיר אותו למטה), בשעות הפעילות של העסק (שעות החיוג ברשימת החיוג, או א׳–ה׳ 09:00–19:00). שום פגישה לא נשמרת ב־EriksVoice. מה הסוכן אומר ומתי הוא משתמש בכל כלי נקבע בהוראות שלך לסוכן.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="min-h-12 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-60">
          {pending ? "שומר…" : "שמירה ועדכון הסוכנים"}
        </button>
        {state.error && <p className="text-[14px] text-destructive">{state.error}</p>}
        {state.ok && <p className="text-[14px] text-success">{state.ok}</p>}
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { crmHookSecretAction, crmImportAction, crmKeyAction, crmLogCallsAutomationAction, crmTestAction, type CrmState } from "./crm-actions";

const inputCls = "h-11 w-full rounded-2xl border border-input bg-card px-3 text-[15px]";
const btn = "min-h-11 rounded-full bg-ink px-4 text-[14px] font-medium text-white disabled:opacity-60";
const btnSoft = "min-h-11 rounded-full bg-muted px-4 text-[14px] font-medium text-ink disabled:opacity-60";

function Msg({ state }: { state: CrmState }) {
  if (state.error) return <p role="alert" className="text-[14px] text-destructive">{state.error}</p>;
  if (state.ok) return <p className="text-[14px] text-success">{state.ok}</p>;
  return null;
}

/** ERIKSCRM for one client: its API key, the webhook back to us, and options. */
export function CrmPanel({
  clientId,
  baseUrlSet,
  hasKey,
  hasHookSecret,
  hookUrl,
  importLeads,
}: {
  clientId: string;
  baseUrlSet: boolean;
  hasKey: boolean;
  hasHookSecret: boolean;
  hookUrl: string;
  importLeads: boolean;
}) {
  const [keyState, keyAction, keyPending] = useActionState<CrmState, FormData>(crmKeyAction, {});
  const [testState, testAction, testPending] = useActionState<CrmState, FormData>(crmTestAction, {});
  const [hookState, hookAction, hookPending] = useActionState<CrmState, FormData>(crmHookSecretAction, {});
  const [autoState, autoAction, autoPending] = useActionState<CrmState, FormData>(crmLogCallsAutomationAction, {});

  if (!baseUrlSet) {
    return <p className="text-[15px] text-ink-muted">קודם מזינים את כתובת ה־API של ה־CRM בהגדרות ← ספקים ← ERIKSCRM.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-[15px] font-medium text-ink">1. מפתח ה־API של העסק</p>
        <p className="text-[13px] text-ink-muted">ב־CRM: לידים ← הגדרות העסק ← EriksVoice ← יצירת מפתח. מדביקים כאן; נבדק מול ה־CRM לפני השמירה.</p>
        <form action={keyAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <input name="key" type="password" dir="ltr" autoComplete="off" placeholder={hasKey ? "שמור. להחלפה מדביקים מפתח חדש" : "המפתח מה־CRM"} className={`${inputCls} min-w-0 flex-1`} />
          <button disabled={keyPending} className={btn}>שמירה ובדיקה</button>
          {hasKey && (
            <button name="disconnect" value="1" disabled={keyPending} className={btnSoft}>ניתוק</button>
          )}
        </form>
        <Msg state={keyState} />
        {hasKey && (
          <form action={testAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="client_id" value={clientId} />
            <button disabled={testPending} className={btnSoft}>בדיקת החיבור</button>
            <Msg state={testState} />
          </form>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-[15px] font-medium text-ink">2. התראות מה־CRM אלינו</p>
        <p className="text-[13px] text-ink-muted">
          ב־CRM, בלשונית EriksVoice: מוסיפים את הכתובת הזו, בוחרים את כל האירועים, ומדביקים את סוד החתימה.
        </p>
        <code dir="ltr" className="block break-all rounded-2xl bg-muted/60 p-3 text-[14px] text-ink">{hookUrl}</code>
        <form action={hookAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="client_id" value={clientId} />
          <button disabled={hookPending} className={btnSoft}>{hasHookSecret ? "יצירת סוד חדש (מחליף את הקודם)" : "יצירת סוד חתימה"}</button>
        </form>
        <Msg state={hookState} />
        {hookState.secret && (
          <code dir="ltr" className="block select-all break-all rounded-2xl border border-border bg-card p-3 text-[14px] text-ink">{hookState.secret}</code>
        )}
        <form action={crmImportAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="client_id" value={clientId} />
          <label className="flex items-center gap-2 text-[15px] text-ink">
            <input type="checkbox" name="import_leads" defaultChecked={importLeads} className="size-5" />
            ליד חדש ב־CRM נכנס לרשימת הלידים של הלקוח (ומפעיל אוטומציות של ״ליד חדש״)
          </label>
          <button className={btnSoft}>שמירה</button>
        </form>
      </section>

      {hasKey && (
        <section className="flex flex-col gap-2">
          <p className="text-[15px] font-medium text-ink">3. רישום שיחות</p>
          <p className="text-[13px] text-ink-muted">
            זיהוי המתקשר מה־CRM פועל לבד כשיש מפתח. כדי שכל שיחה תירשם בכרטיס הליד מוסיפים אוטומציה (אפשר לערוך אותה אחר כך באוטומציות של הלקוח).
          </p>
          <form action={autoAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="client_id" value={clientId} />
            <button disabled={autoPending} className={btnSoft}>הוספת אוטומציה: כל שיחה נרשמת ב־CRM</button>
            <Msg state={autoState} />
          </form>
        </section>
      )}
    </div>
  );
}

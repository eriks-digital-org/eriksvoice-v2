"use client";

import { useActionState, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ds/kit";
import { cn } from "@/lib/utils";
import { AGENT_TYPE_KEYS, agentTypeLabels, type AgentTypeKey } from "@/lib/agent-types";
import { characterForType } from "@/components/agents/characters";
import { createClientAction, type WizardState } from "./actions";

const STEPS = ["פרטי העסק", "סוכנים", "מספר טלפון"];
const STEP_OF_FIELD: Record<string, number> = {
  name: 0, slug: 0, industry: 0, address: 0, hours: 0, contact_phone: 0, notify_email: 0, description: 0,
  member_email: 0, member_name: 0, monthly_minutes: 0, types: 1, phone: 2, inbound_type: 2,
};

export function Wizard({ purposes }: { purposes: Record<string, string> }) {
  const [step, setStep] = useState(0);
  const [types, setTypes] = useState<AgentTypeKey[]>(["leads", "sales", "service", "support"]);
  const [inbound, setInbound] = useState<string>("service");
  const [state, action, pending] = useActionState<WizardState, FormData>(async (prev, form) => {
    const res = await createClientAction(prev, form);
    if (res.field && res.field in STEP_OF_FIELD) setStep(STEP_OF_FIELD[res.field]!);
    return res;
  }, {});

  const toggle = (t: AgentTypeKey) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const input = "h-12 rounded-2xl text-[16px]";

  return (
    <form action={action} className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2" aria-label="שלבים">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors",
                i === step ? "bg-ink text-white" : i < step ? "bg-success-soft text-success" : "bg-card text-ink-muted",
              )}
            >
              <span className={cn("grid size-6 place-items-center rounded-full text-[13px]", i === step ? "bg-cta-dot text-black" : "bg-white/70")}>
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      {/* All steps stay in the form (hidden when not shown), so one submit sends everything. */}
      <section className={cn("surface grid gap-5 p-[22px] sm:grid-cols-2 sm:p-8", step !== 0 && "hidden")}>
        <Field label="שם העסק">
          <Input name="name" required className={input} />
        </Field>
        <Field label="כתובת הפורטל" hint="eriksvoice.co.il/… · אותיות באנגלית, ספרות ומקף">
          <Input name="slug" required dir="ltr" pattern="[a-z0-9-]+" className={cn(input, "text-end")} placeholder="my-business" />
        </Field>
        <Field label="תחום">
          <Input name="industry" className={input} />
        </Field>
        <Field label="כתובת">
          <Input name="address" className={input} />
        </Field>
        <Field label="שעות פעילות" hint="למשל: א׳–ה׳ 9:00–18:00, ו׳ 9:00–13:00">
          <Input name="hours" className={input} />
        </Field>
        <Field label="טלפון העסק">
          <Input name="contact_phone" dir="ltr" inputMode="tel" className={cn(input, "text-end")} />
        </Field>
        <Field label="מייל להתראות">
          <Input name="notify_email" type="email" dir="ltr" className={cn(input, "text-end")} />
        </Field>
        <Field label="מכסת דקות חודשית">
          <Input name="monthly_minutes" type="number" min={0} defaultValue={500} dir="ltr" className={cn(input, "text-end")} />
        </Field>
        <Field label="שם משתמש הלקוח" hint="יופיע לו ״שלום [שם]״ במערכת">
          <Input name="member_name" className={input} />
        </Field>
        <Field label="מייל של משתמש הלקוח" hint="נשלחת אליו סיסמה זמנית במייל">
          <Input name="member_email" type="email" dir="ltr" className={cn(input, "text-end")} />
        </Field>
        <Field label="תיאור כללי של העסק" hint="נכנס לפרומפט של הסוכנים, ונוצר גם כפריט ראשון במאגר הידע" className="sm:col-span-2">
          <Textarea name="description" rows={5} className="rounded-2xl text-[16px]" />
        </Field>
      </section>

      <section className={cn("surface p-[22px] sm:p-8", step !== 1 && "hidden")}>
        <p className="mb-4 text-[16px] text-ink-muted">הסוכנים נוצרים כבויים ונשמרים רק אצלנו. מפעילים כל אחד ממסך הלקוח.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AGENT_TYPE_KEYS.map((t) => {
            const on = types.includes(t);
            const c = characterForType(t, t);
            return (
              <label
                key={t}
                className={cn(
                  "flex min-h-20 cursor-pointer items-center gap-4 rounded-[22px] border-2 p-3 transition-colors",
                  on ? "border-violet bg-tint" : "border-transparent bg-muted/60",
                )}
              >
                <input type="checkbox" name="types" value={t} checked={on} onChange={() => toggle(t)} className="sr-only" />
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: c.wash }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.smile} alt="" className="size-14 object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-medium text-ink">{agentTypeLabels[t]}</span>
                  <span className="block text-[14px] text-ink-muted">{purposes[t]}</span>
                </span>
                <span className={cn("grid size-7 place-items-center rounded-full", on ? "bg-ink text-cta-dot" : "bg-white text-transparent")}>
                  <Check className="size-4" />
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className={cn("surface grid gap-5 p-[22px] sm:grid-cols-2 sm:p-8", step !== 2 && "hidden")}>
        <Field label="מספר טלפון (רשות)" hint="מספר שנקנה ב־Twilio, בפורמט +972…">
          <Input name="phone" dir="ltr" inputMode="tel" className={cn(input, "text-end")} placeholder="+972" />
        </Field>
        <Field label="מי עונה לשיחות נכנסות">
          <select
            name="inbound_type"
            value={inbound}
            onChange={(e) => setInbound(e.target.value)}
            className="h-12 rounded-2xl border border-input bg-transparent px-3 text-[16px]"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {agentTypeLabels[t]}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {state.error && (
        <p role="alert" className="rounded-[18px] bg-destructive-soft p-3.5 text-[16px] text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-card px-5 text-[16px] font-medium text-ink shadow-soft">
            <ArrowRight className="size-4" /> הקודם
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => setStep(step + 1)} className="cta-pill group">
            הבא
            <span className="cta-dot group-hover:-rotate-90">
              <ArrowLeft className="size-[22px]" strokeWidth={2.2} />
            </span>
          </button>
        ) : (
          <button type="submit" disabled={pending} className="cta-pill group">
            פתיחת הלקוח
            <span className="cta-dot group-hover:-rotate-90">
              {pending ? <Loader2 className="size-[22px] animate-spin" /> : <Check className="size-[22px]" strokeWidth={2.2} />}
            </span>
          </button>
        )}
      </div>
    </form>
  );
}

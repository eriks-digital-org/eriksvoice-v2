"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ds/kit";
import type { AgentTypeRow } from "@/lib/data/types";
import { saveAgentType, type SaveState } from "./actions";

export function TypeForm({ type }: { type: AgentTypeRow }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveAgentType, {});
  const input = "h-12 rounded-2xl text-[16px]";
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="key" value={type.key} />
      <section className="surface grid gap-5 p-[22px] sm:grid-cols-2 sm:p-8">
        <Field label="שם הסוג">
          <Input name="name" defaultValue={type.name} required className={input} />
        </Field>
        <Field label="מטרה עיקרית">
          <Input name="purpose" defaultValue={type.purpose} className={input} />
        </Field>
        <Field
          label="פרומפט (תבנית הסוג)"
          hint="טון דיבור, אופי, מטרות והנחיות. בלי שם של עסק: פרטי העסק, הידע והאוטומציות של כל לקוח נוספים אוטומטית."
          className="sm:col-span-2"
        >
          <Textarea name="prompt" defaultValue={type.prompt} rows={16} className="rounded-2xl text-[16px] leading-relaxed" />
        </Field>
      </section>
      <section className="surface grid gap-5 p-[22px] sm:grid-cols-2 sm:p-8">
        <h2 className="text-[20px] font-medium text-ink sm:col-span-2">מודל וקול</h2>
        <p className="-mt-3 text-[15px] text-ink-muted sm:col-span-2">
          בחירה מתוך הרשימות של ElevenLabs תיפתח כאן אחרי חיבור המפתח. עד אז אפשר להדביק מזהים.
        </p>
        <Field label="מודל שיחה" hint="למשל gemini-2.5-flash">
          <Input name="llm_model" defaultValue={type.llm_model} dir="ltr" className={`${input} text-end`} />
        </Field>
        <Field label="קול ברירת מחדל (Voice ID)">
          <Input name="default_voice_id" defaultValue={type.default_voice_id} dir="ltr" className={`${input} text-end`} />
        </Field>
        <Field label="קולות שהלקוח יכול לבחור" hint="מזהי קולות, מופרדים בפסיק" className="sm:col-span-2">
          <Input name="allowed_voice_ids" defaultValue={type.allowed_voice_ids.join(", ")} dir="ltr" className={`${input} text-end`} />
        </Field>
      </section>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="cta-pill group">
          שמירה
          <span className="cta-dot group-hover:-rotate-90">
            {pending ? <Loader2 className="size-[22px] animate-spin" /> : <Check className="size-[22px]" strokeWidth={2.2} />}
          </span>
        </button>
        {state.error && <p role="alert" className="text-[16px] text-destructive">{state.error}</p>}
        {state.ok && <p className="text-[16px] text-success">{state.ok}</p>}
      </div>
    </form>
  );
}

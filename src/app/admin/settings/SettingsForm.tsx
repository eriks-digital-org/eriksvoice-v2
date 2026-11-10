"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ds/kit";
import { saveSettings, type SaveState } from "./actions";

export function SettingsForm({ safety, emails, hours }: { safety: string; emails: string[]; hours: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveSettings, {});
  return (
    <form action={action} className="flex flex-col gap-6">
      <section className="surface grid gap-5 p-[22px] sm:p-8">
        <Field
          label="כללי מערכת ובטיחות"
          hint="השכבה הראשונה בפרומפט של כל סוכן אצל כל הלקוחות, כולל הודעת ההקלטה בפתיח. גוברת על כל שכבה אחרת בבטיחות ובטון."
        >
          <Textarea name="safety_rules" defaultValue={safety} rows={12} className="rounded-2xl text-[16px] leading-relaxed" />
        </Field>
        <Field label="מיילים להתראות אדמין" hint="מופרדים בפסיק">
          <Input name="alert_emails" defaultValue={emails.join(", ")} dir="ltr" className="h-12 rounded-2xl text-end text-[16px]" />
        </Field>
        <Field label="שעות פעילות ברירת מחדל">
          <Input name="hours" defaultValue={hours} className="h-12 rounded-2xl text-[16px]" />
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

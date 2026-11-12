"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ds/kit";
import { cn } from "@/lib/utils";
import { updateClientAction, type EditState } from "./actions";

export interface EditValues {
  id: string;
  name: string;
  slug: string;
  industry: string;
  address: string;
  hours: string;
  contact_phone: string;
  notify_email: string;
  description: string;
  monthly_minutes: number;
}

export function EditForm({ v }: { v: EditValues }) {
  const [state, action, pending] = useActionState<EditState, FormData>(updateClientAction, {});
  const input = "h-12 rounded-2xl text-[16px]";
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="client_id" value={v.id} />
      <section className="surface grid gap-5 p-[22px] sm:grid-cols-2 sm:p-8">
        <Field label="שם העסק">
          <Input name="name" required defaultValue={v.name} className={input} />
        </Field>
        <Field label="כתובת הפורטל" hint="eriksvoice.co.il/… · שינוי משנה את הכתובת שהלקוח נכנס אליה">
          <Input name="slug" required dir="ltr" pattern="[a-z0-9-]+" defaultValue={v.slug} className={cn(input, "text-end")} />
        </Field>
        <Field label="תחום">
          <Input name="industry" defaultValue={v.industry} className={input} />
        </Field>
        <Field label="כתובת">
          <Input name="address" defaultValue={v.address} className={input} />
        </Field>
        <Field label="שעות פעילות" hint="למשל: א׳–ה׳ 9:00–18:00, ו׳ 9:00–13:00">
          <Input name="hours" defaultValue={v.hours} className={input} />
        </Field>
        <Field label="טלפון העסק">
          <Input name="contact_phone" dir="ltr" inputMode="tel" defaultValue={v.contact_phone} className={cn(input, "text-end")} />
        </Field>
        <Field label="מייל להתראות">
          <Input name="notify_email" type="email" dir="ltr" defaultValue={v.notify_email} className={cn(input, "text-end")} />
        </Field>
        <Field label="מכסת דקות חודשית">
          <Input name="monthly_minutes" type="number" min={0} defaultValue={v.monthly_minutes} dir="ltr" className={cn(input, "text-end")} />
        </Field>
        <Field label="תיאור כללי של העסק" hint="לשימוש פנימי. את המידע שהסוכנים משתמשים בו עורכים במאגר הידע" className="sm:col-span-2">
          <Textarea name="description" rows={5} defaultValue={v.description} className="rounded-2xl text-[16px]" />
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

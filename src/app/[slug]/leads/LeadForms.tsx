"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ds/kit";
import { addLeadAction, importCsvAction, saveDialerAction, type LeadState } from "./actions";

const inputCls = "h-12 rounded-2xl text-[16px]";
const selectCls = "h-12 w-full rounded-2xl border border-input bg-card px-3 text-[16px]";

function Msg({ s }: { s: LeadState }) {
  if (s.error) return <p className="text-[14px] text-destructive">{s.error}</p>;
  if (s.ok) return <p className="text-[14px] text-success">{s.ok}</p>;
  return null;
}

export function AddLeadForm({ slug }: { slug: string }) {
  const [s, action, pending] = useActionState<LeadState, FormData>(addLeadAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="slug" value={slug} />
      <Field label="שם">
        <Input name="name" className={inputCls} />
      </Field>
      <Field label="טלפון">
        <Input name="phone" required dir="ltr" placeholder="050-1234567" className={`${inputCls} text-end`} />
      </Field>
      <Field label="תיקיות" hint="מופרדות בפסיק">
        <Input name="tags" className={inputCls} />
      </Field>
      <Field label="הערות">
        <Input name="notes" className={inputCls} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <label className="flex min-h-11 items-center gap-2 text-[15px] text-ink">
          <input type="checkbox" name="queue" value="1" className="size-4" />
          להכניס לתור החיוג
        </label>
        <button disabled={pending} className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-60">
          {pending ? "מוסיף…" : "הוספה"}
        </button>
        <Msg s={s} />
      </div>
    </form>
  );
}

export function ImportForm({ slug }: { slug: string }) {
  const [s, action, pending] = useActionState<LeadState, FormData>(importCsvAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <p className="text-[14px] text-ink-muted">
        קובץ CSV עם עמודת טלפון ועמודת שם (כותרות כמו &quot;שם&quot; ו&quot;טלפון&quot;). מאקסל: קובץ ← שמירה בשם ← CSV UTF-8. עד 5,000 שורות.
      </p>
      <input name="file" type="file" accept=".csv,text/csv" required className="text-[15px]" />
      <Field label="תיקייה לכל הלידים בקובץ" hint="לא חובה">
        <Input name="tags" className={inputCls} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-[15px] text-ink">
          <input type="checkbox" name="queue" value="1" className="size-4" />
          להכניס לתור החיוג
        </label>
        <button disabled={pending} className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-60">
          {pending ? "מייבא…" : "ייבוא"}
        </button>
        <Msg s={s} />
      </div>
    </form>
  );
}

const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const time = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export interface DialerView {
  enabled: boolean;
  agent_id: string | null;
  tag: string;
  start_minute: number;
  end_minute: number;
  days: number[];
  max_attempts: number;
  retry_minutes: number;
  concurrency: number;
}

export function DialerForm({ slug, settings, agents, tags }: { slug: string; settings: DialerView; agents: { id: string; name: string }[]; tags: string[] }) {
  const [s, action, pending] = useActionState<LeadState, FormData>(saveDialerAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="slug" value={slug} />
      <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-tint px-4 text-[16px] font-medium text-ink sm:col-span-2">
        <input type="checkbox" name="enabled" value="1" defaultChecked={settings.enabled} className="size-5 accent-[var(--violet)]" />
        התותח פועל
        <span className="text-[14px] font-normal text-ink-muted">· עד {settings.concurrency} שיחות במקביל</span>
      </label>
      <Field label="הסוכן שמתקשר">
        <select name="agent_id" defaultValue={settings.agent_id ?? ""} className={selectCls}>
          <option value="">בחירה</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="למי מתקשרים">
        <select name="tag" defaultValue={settings.tag} className={selectCls}>
          <option value="">כל הלידים בתור</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              תיקייה: {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="משעה">
        <Input name="start" type="time" defaultValue={time(settings.start_minute)} dir="ltr" className={inputCls} />
      </Field>
      <Field label="עד שעה">
        <Input name="end" type="time" defaultValue={time(settings.end_minute)} dir="ltr" className={inputCls} />
      </Field>
      <fieldset className="flex flex-wrap gap-2 sm:col-span-2">
        <legend className="mb-2 text-[15px] font-medium text-ink">ימים</legend>
        {DAYS.map((d, i) => (
          <label key={d} className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-full bg-muted/60 px-3 text-[15px] has-[:checked]:bg-ink has-[:checked]:text-white">
            <input type="checkbox" name="days" value={i} defaultChecked={settings.days.includes(i)} className="sr-only" />
            {d}
          </label>
        ))}
      </fieldset>
      <Field label="ניסיונות לכל ליד" hint="עד 3">
        <Input name="max_attempts" type="number" min={1} max={3} defaultValue={settings.max_attempts} dir="ltr" className={`${inputCls} text-end`} />
      </Field>
      <Field label="המתנה בין ניסיונות (דקות)">
        <Input name="retry_minutes" type="number" min={10} max={2880} defaultValue={settings.retry_minutes} dir="ltr" className={`${inputCls} text-end`} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="min-h-12 rounded-full bg-ink px-6 text-[16px] font-medium text-white disabled:opacity-60">
          {pending ? "שומר…" : "שמירה"}
        </button>
        <Msg s={s} />
      </div>
    </form>
  );
}

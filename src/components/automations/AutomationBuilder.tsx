"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ds/kit";
import { ACTIONS, HOURS, TRIGGERS, VARIABLES, actionOf, describe, type ActionType, type AutomationSpec, type TriggerType } from "@/lib/automations/catalog";

const selectCls = "h-12 w-full rounded-2xl border border-input bg-card px-3 text-[16px]";
const inputCls = "h-12 rounded-2xl text-[16px]";
const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DELAYS = [
  [0, "מיד"],
  [1, "אחרי דקה"],
  [5, "אחרי 5 דקות"],
  [15, "אחרי רבע שעה"],
  [30, "אחרי חצי שעה"],
  [60, "אחרי שעה"],
  [120, "אחרי שעתיים"],
  [1440, "אחרי יום"],
  [2880, "אחרי יומיים"],
] as const;

/**
 * The automation builder: "כאשר… ← מתי… ← אז…". Writes the spec as JSON into a hidden
 * input named "spec", so it works inside any server-action form.
 */
export function AutomationBuilder({
  initial,
  agents,
  name: initialName = "",
}: {
  initial: AutomationSpec;
  agents: { id: string; name: string }[];
  name?: string;
}) {
  const [spec, setSpec] = useState<AutomationSpec>(initial);
  const [name, setName] = useState(initialName);
  const [adding, setAdding] = useState<ActionType | "">("");
  const set = (patch: Partial<AutomationSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const setTrigger = (type: TriggerType) => set({ trigger: { type, config: type === "daily" || type === "weekly" ? { time: "18:00", day: 0 } : {} } });
  const setConfig = (k: string, v: string | number) => set({ trigger: { ...spec.trigger, config: { ...spec.trigger.config, [k]: v } } });
  const needsAgent = spec.actions.some((a) => actionOf(a.type)?.needsAgent);
  const scheduled = spec.trigger.type === "daily" || spec.trigger.type === "weekly";

  return (
    <div className="flex flex-col gap-6">
      <input type="hidden" name="spec" value={JSON.stringify(spec)} />
      <Field label="שם">
        <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="למשל: ליד חדש ← שיחה מיידית" className={inputCls} />
      </Field>

      <section className="flex flex-col gap-3 rounded-3xl bg-tint/60 p-4 sm:p-5">
        <h3 className="text-[17px] font-medium text-ink">כאשר</h3>
        <select value={spec.trigger.type} onChange={(e) => setTrigger(e.target.value as TriggerType)} className={selectCls}>
          {TRIGGERS.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-[13px] text-ink-muted">{TRIGGERS.find((t) => t.type === spec.trigger.type)?.hint}</p>
        {spec.trigger.type === "call_ended" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="כיוון">
              <select value={spec.trigger.config.direction ?? "any"} onChange={(e) => setConfig("direction", e.target.value)} className={selectCls}>
                <option value="any">כל השיחות</option>
                <option value="inbound">נכנסות</option>
                <option value="outbound">יוצאות</option>
              </select>
            </Field>
            <Field label="תוצאה">
              <select value={spec.trigger.config.outcome ?? "any"} onChange={(e) => setConfig("outcome", e.target.value)} className={selectCls}>
                <option value="any">כל תוצאה</option>
                <option value="success">הצליחה</option>
                <option value="failure">לא הצליחה</option>
              </select>
            </Field>
          </div>
        )}
        {spec.trigger.type.startsWith("lead_") && (
          <Field label="רק לידים בתיקייה" hint="ריק = כל הלידים">
            <Input value={spec.trigger.config.tag ?? ""} onChange={(e) => setConfig("tag", e.target.value)} className={inputCls} />
          </Field>
        )}
        {spec.trigger.type === "webhook_in" && (
          <Field label="רק אירוע בשם" hint='השדה "event" בנתונים. ריק = כל מה שנכנס'>
            <Input value={spec.trigger.config.event ?? ""} onChange={(e) => setConfig("event", e.target.value)} dir="ltr" className={`${inputCls} text-end`} placeholder="meeting_booked" />
          </Field>
        )}
        {scheduled && (
          <div className="grid gap-3 sm:grid-cols-2">
            {spec.trigger.type === "weekly" && (
              <Field label="יום">
                <select value={spec.trigger.config.day ?? 0} onChange={(e) => setConfig("day", Number(e.target.value))} className={selectCls}>
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      יום {d}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="שעה">
              <Input type="time" value={spec.trigger.config.time ?? "18:00"} onChange={(e) => setConfig("time", e.target.value)} dir="ltr" className={inputCls} />
            </Field>
          </div>
        )}
      </section>

      {!scheduled && (
        <section className="flex flex-col gap-3 rounded-3xl bg-tint/60 p-4 sm:p-5">
          <h3 className="text-[17px] font-medium text-ink">מתי</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="שעות">
              <select value={spec.hours.mode} onChange={(e) => set({ hours: { ...spec.hours, mode: e.target.value as AutomationSpec["hours"]["mode"] } })} className={selectCls}>
                {HOURS.map((h) => (
                  <option key={h.mode} value={h.mode}>
                    {h.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="השהיה">
              <select value={spec.delay_minutes} onChange={(e) => set({ delay_minutes: Number(e.target.value) })} className={selectCls}>
                {DELAYS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {spec.hours.mode === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="משעה">
                <Input type="time" value={spec.hours.start ?? "09:00"} onChange={(e) => set({ hours: { ...spec.hours, start: e.target.value } })} dir="ltr" className={inputCls} />
              </Field>
              <Field label="עד שעה">
                <Input type="time" value={spec.hours.end ?? "18:00"} onChange={(e) => set({ hours: { ...spec.hours, end: e.target.value } })} dir="ltr" className={inputCls} />
              </Field>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {DAYS.map((d, i) => {
                  const on = (spec.hours.days ?? [0, 1, 2, 3, 4]).includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const cur = spec.hours.days ?? [0, 1, 2, 3, 4];
                        set({ hours: { ...spec.hours, days: on ? cur.filter((x) => x !== i) : [...cur, i] } });
                      }}
                      className={`min-h-11 min-w-11 rounded-full px-3 text-[15px] ${on ? "bg-ink text-white" : "bg-card text-ink"}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-3xl bg-tint/60 p-4 sm:p-5">
        <h3 className="text-[17px] font-medium text-ink">אז</h3>
        {needsAgent && (
          <Field label="הסוכן שמתקשר / שולח מהמספר שלו">
            <select value={spec.agent_id ?? ""} onChange={(e) => set({ agent_id: e.target.value || null })} className={selectCls}>
              <option value="">בחירה</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <ol className="flex flex-col gap-3">
          {spec.actions.map((a, i) => {
            const def = actionOf(a.type);
            return (
              <li key={i} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[16px] font-medium text-ink">
                    {i + 1}. {def?.label}
                  </span>
                  <button
                    type="button"
                    aria-label="הסרה"
                    onClick={() => set({ actions: spec.actions.filter((_, j) => j !== i) })}
                    className="grid size-10 place-items-center rounded-full text-destructive hover:bg-destructive-soft"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {def?.fields.map((f) => {
                  const v = a.config[f.key] ?? "";
                  const onChange = (val: string) =>
                    set({ actions: spec.actions.map((x, j) => (j === i ? { ...x, config: { ...x.config, [f.key]: val } } : x)) });
                  return (
                    <Field key={f.key} label={f.label} hint={f.hint}>
                      {f.kind === "textarea" ? (
                        <Textarea value={v} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={f.placeholder} className="rounded-2xl text-[16px]" />
                      ) : (
                        <Input
                          value={v}
                          onChange={(e) => onChange(e.target.value)}
                          placeholder={f.placeholder}
                          dir={f.kind === "url" || f.kind === "email" ? "ltr" : undefined}
                          className={inputCls}
                        />
                      )}
                    </Field>
                  );
                })}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          <select value={adding} onChange={(e) => setAdding(e.target.value as ActionType)} className={`${selectCls} max-w-xs`}>
            <option value="">פעולה נוספת…</option>
            {ACTIONS.map((a) => (
              <option key={a.type} value={a.type}>
                {a.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!adding}
            onClick={() => {
              if (!adding) return;
              set({ actions: [...spec.actions, { type: adding, config: {} }] });
              setAdding("");
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-40"
          >
            <Plus className="size-4" />
            הוספה
          </button>
        </div>
        <p className="text-[13px] text-ink-muted">
          אפשר לשלב בטקסט: {VARIABLES.map((v) => `{{${v}}}`).join(" ")}
        </p>
      </section>

      <Field label="מה הסוכנים צריכים לדעת" hint="לא חובה. נוסף להנחיות של הסוכנים כל עוד האוטומציה פעילה, למשל: אם הלקוח מבקש נציג, תגיד שנחזור אליו תוך שעה.">
        <Textarea value={spec.instruction ?? ""} onChange={(e) => set({ instruction: e.target.value })} rows={3} className="rounded-2xl text-[16px]" />
      </Field>

      <p className="rounded-2xl bg-card p-4 text-[16px] leading-relaxed text-ink shadow-soft">{describe(spec)}</p>
    </div>
  );
}

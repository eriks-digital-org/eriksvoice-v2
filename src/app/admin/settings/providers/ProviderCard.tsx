"use client";

import { useActionState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ds/kit";
import { Pill } from "@/components/ds/StatusBadge";
import type { ProviderDef } from "@/lib/providers/registry";
import { saveProviderAction, testProviderAction, type ProviderState } from "./actions";

type Info = { source: "panel" | "env"; shown: string; updatedAt: string | null } | null;

function Result({ state }: { state: ProviderState }) {
  return (
    <>
      {state.error && <p className="text-[14px] text-destructive">{state.error}</p>}
      {state.ok && <p className="text-[14px] text-success">{state.ok}</p>}
      {state.test && (
        <p className={`flex items-center gap-1.5 text-[14px] ${state.test.ok ? "text-success" : "text-destructive"}`}>
          {state.test.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          בדיקה: {state.test.message}
        </p>
      )}
    </>
  );
}

export function ProviderCard({ def, info }: { def: ProviderDef; info: Record<string, Info> }) {
  const [saved, save, saving] = useActionState<ProviderState, FormData>(saveProviderAction, {});
  const [tested, test, testing] = useActionState<ProviderState, FormData>(testProviderAction, {});
  const configured = def.fields.every((f) => f.optional || info[f.name]);
  return (
    <section className="surface flex flex-col gap-4 p-[22px] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-medium text-ink">{def.name}</h2>
          <p className="text-[14px] text-ink-muted">{def.purpose}</p>
        </div>
        {configured ? <Pill tone="success">מוגדר</Pill> : <Pill tone="warning">חסר</Pill>}
      </div>

      <form action={save} className="flex flex-col gap-4" autoComplete="off">
        <input type="hidden" name="provider" value={def.key} />
        {def.fields.map((f) => {
          const i = info[f.name];
          return (
            <Field key={f.name} label={f.label} hint={f.hint}>
              <div className="flex flex-col gap-1.5">
                <p className="text-[13px] text-ink-muted">
                  {i ? (
                    <>
                      נוכחי: <span dir="ltr" className="num text-ink">{i.shown}</span> ·{" "}
                      {i.source === "panel"
                        ? `נשמר במערכת${i.updatedAt ? ` ב־${new Date(i.updatedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}` : ""}`
                        : "מ־Vercel"}
                    </>
                  ) : (
                    "לא מוגדר"
                  )}
                </p>
                <div className="flex gap-2">
                  <Input
                    name={f.name}
                    type={f.secret ? "password" : "text"}
                    dir="ltr"
                    placeholder={i ? "השאירו ריק כדי לא לשנות" : f.placeholder}
                    autoComplete="new-password"
                    className="h-12 flex-1 rounded-2xl text-end text-[16px]"
                  />
                  {i?.source === "panel" && (
                    <button
                      name="clear"
                      value={f.name}
                      formNoValidate
                      className="min-h-12 rounded-full px-3 text-[14px] font-medium text-destructive"
                      title="מחיקת הערך שנשמר במערכת"
                    >
                      הסרה
                    </button>
                  )}
                </div>
              </div>
            </Field>
          );
        })}
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={saving} className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-60">
            {saving ? "שומר…" : "שמירה ובדיקה"}
          </button>
          <button
            formAction={test}
            disabled={testing}
            className="min-h-11 rounded-full bg-card px-5 text-[15px] font-medium text-ink shadow-soft disabled:opacity-60"
          >
            {testing ? "בודק…" : "בדיקת חיבור"}
          </button>
        </div>
        <Result state={saved} />
        <Result state={tested} />
      </form>
    </section>
  );
}

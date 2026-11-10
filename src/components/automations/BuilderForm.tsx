"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { AutomationSpec } from "@/lib/automations/catalog";
import { AutomationBuilder } from "./AutomationBuilder";

type State = { error?: string; ok?: string };

/** The builder inside a form bound to a server action, with hidden fields. */
export function BuilderForm({
  action,
  hidden,
  initial,
  name,
  agents,
  submitLabel = "שמירה",
  children,
}: {
  action: (s: State, f: FormData) => Promise<State>;
  hidden: Record<string, string>;
  initial: AutomationSpec;
  name?: string;
  agents: { id: string; name: string }[];
  submitLabel?: string;
  /** Extra fields shown above the builder (e.g. a template's gallery text). */
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-6">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <AutomationBuilder initial={initial} agents={agents} name={name} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="cta-pill group">
          {submitLabel}
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

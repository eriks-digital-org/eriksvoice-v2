"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Power } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ds/kit";
import { AgentStatusBadge, Pill } from "@/components/ds/StatusBadge";
import { characterForType } from "@/components/agents/characters";
import { agentTypeLabels } from "@/lib/agent-types";
import type { AgentRow } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { agentOverrideAction, agentPowerAction, type ActionState } from "./actions";

const selectCls = "h-12 w-full rounded-2xl border border-input bg-card px-3 text-[16px]";

export function AgentAdminCard({
  agent,
  voices,
  llms,
}: {
  agent: AgentRow & { provider_agent_id?: string | null };
  voices: { id: string; name: string }[];
  llms: string[];
}) {
  const [power, powerAction, powering] = useActionState<ActionState, FormData>(agentPowerAction, {});
  const [saved, saveAction, saving] = useActionState<ActionState, FormData>(agentOverrideAction, {});
  const [open, setOpen] = useState(false);
  const c = characterForType(agent.type_key, agent.id);
  const active = agent.status === "active";

  return (
    <li className="flex flex-col gap-3 rounded-[22px] bg-muted/60 p-3 sm:p-4">
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: c.wash }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.smile} alt="" className="size-14 object-contain" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-medium text-ink">{agent.name}</span>
          <span className="block text-[14px] text-ink-muted">{agentTypeLabels[agent.type_key]}</span>
        </span>
        <AgentStatusBadge status={agent.status} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form action={powerAction}>
          <input type="hidden" name="agent_id" value={agent.id} />
          <input type="hidden" name="on" value={active ? "0" : "1"} />
          <button
            disabled={powering}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium disabled:opacity-60",
              active ? "bg-card text-ink shadow-soft" : "bg-ink text-white",
            )}
          >
            <Power className="size-4" />
            {powering ? "רגע…" : active ? "כיבוי" : "הפעלה"}
          </button>
        </form>
        {agent.sync_status === "failed" && <Pill tone="danger">הסנכרון נכשל</Pill>}
        {agent.sync_status === "ok" && agent.status !== "draft" && <Pill tone="success">מסונכרן</Pill>}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="ms-auto inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[14px] text-violet">
          הגדרות הסוכן <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {(power.error || agent.sync_error) && (
        <p className="rounded-2xl bg-destructive-soft p-3 text-[14px] text-destructive">{power.error ?? agent.sync_error}</p>
      )}
      {power.ok && <p className="text-[14px] text-success">{power.ok}</p>}
      {open && (
        <form action={saveAction} className="grid gap-4 rounded-2xl bg-card p-4">
          <input type="hidden" name="agent_id" value={agent.id} />
          <Field label="שם הסוכן">
            <Input name="name" defaultValue={agent.name} className="h-12 rounded-2xl" />
          </Field>
          <Field label="משפט פתיח">
            <Textarea name="opening_line" defaultValue={agent.opening_line} rows={2} className="rounded-2xl" />
          </Field>
          <Field label="קול" hint="ריק = הקול של הסוג">
            <select name="voice_id" defaultValue={agent.voice_id ?? ""} className={selectCls}>
              <option value="">הקול של הסוג</option>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="מודל שיחה" hint="ריק = המודל של הסוג">
            <select name="llm_model_override" defaultValue={agent.llm_model_override ?? ""} className={selectCls} dir="ltr">
              <option value="">המודל של הסוג</option>
              {llms.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="הנחיות לסוכן הזה" hint={agent.type_key === "custom" ? "ההנחיות של הסוכן המותאם אישית" : "נוספות אחרי תבנית הסוג. אפשר להשאיר ריק."}>
            <Textarea name="custom_prompt" defaultValue={agent.custom_prompt ?? ""} rows={6} className="rounded-2xl" />
          </Field>
          <div className="flex items-center gap-3">
            <button disabled={saving} className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-medium text-white disabled:opacity-60">
              {saving ? "שומר…" : "שמירה"}
            </button>
            {saved.error && <p className="text-[14px] text-destructive">{saved.error}</p>}
            {saved.ok && <p className="text-[14px] text-success">{saved.ok}</p>}
          </div>
        </form>
      )}
    </li>
  );
}

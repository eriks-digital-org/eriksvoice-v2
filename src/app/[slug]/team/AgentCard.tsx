"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ds/kit";
import { AgentStatusBadge } from "@/components/ds/StatusBadge";
import { characterForType } from "@/components/agents/characters";
import { agentTypeLabels } from "@/lib/agent-types";
import type { AgentRow } from "@/lib/data/types";
import { saveAgent, type SaveState } from "./actions";

export function AgentCard({ agent, slug, phone }: { agent: AgentRow; slug: string; phone?: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveAgent, {});
  const c = characterForType(agent.type_key, agent.id);
  return (
    <form action={action} className="surface flex flex-col gap-5 p-[22px] sm:p-8">
      <input type="hidden" name="id" value={agent.id} />
      <input type="hidden" name="slug" value={slug} />
      <div className="flex items-center gap-4">
        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: c.wash }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.smile} alt="" className="size-20 object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[22px] font-medium text-ink">{agent.name}</h2>
          <p className="text-[15px] text-ink-muted">
            {agentTypeLabels[agent.type_key]}
            {phone && (
              <>
                {" · "}
                <span className="num">{phone}</span>
              </>
            )}
          </p>
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>
      <Field label="שם הסוכן">
        <Input name="name" defaultValue={agent.name} required className="h-12 rounded-2xl text-[16px]" />
      </Field>
      <Field label="משפט הפתיח" hint="מה הסוכן אומר כשהוא עונה">
        <Textarea name="opening_line" defaultValue={agent.opening_line} rows={2} className="rounded-2xl text-[16px]" />
      </Field>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="min-h-12 rounded-full bg-ink px-6 text-[16px] font-medium text-white disabled:opacity-60">
          {pending ? "שומר…" : "שמירה"}
        </button>
        {state.error && <p className="text-[15px] text-destructive">{state.error}</p>}
        {state.ok && <p className="text-[15px] text-success">{state.ok}</p>}
      </div>
    </form>
  );
}

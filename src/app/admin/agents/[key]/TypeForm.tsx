"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Loader2, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ds/kit";
import { cn } from "@/lib/utils";
import type { AgentTypeRow } from "@/lib/data/types";
import { HEBREW_TTS_MODELS, type AllowedVoice } from "@/lib/voice/models";
import { saveAgentType, type SaveState } from "./actions";

interface Voice {
  id: string;
  name: string;
  description: string;
  previewUrl: string | null;
}

const selectCls = "h-12 w-full rounded-2xl border border-input bg-card px-3 text-[16px]";

export function TypeForm({
  type,
  voices,
  llms,
  connected,
  catalogError,
}: {
  type: AgentTypeRow & { allowed_voices: AllowedVoice[]; tts_model: string };
  voices: Voice[];
  llms: string[];
  connected: boolean;
  catalogError?: string;
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveAgentType, {});
  const [allowed, setAllowed] = useState<AllowedVoice[]>(type.allowed_voices ?? []);
  const [defaultVoice, setDefaultVoice] = useState(type.default_voice_id);
  const [filter, setFilter] = useState("");
  const input = "h-12 rounded-2xl text-[16px]";
  const vs = (type.voice_settings ?? {}) as Record<string, number>;
  const turn = (type.conversation_settings ?? {}) as Record<string, string | number>;

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? voices.filter((v) => `${v.name} ${v.description}`.toLowerCase().includes(f)) : voices;
  }, [voices, filter]);
  const toggle = (v: Voice) =>
    setAllowed((cur) => (cur.some((a) => a.id === v.id) ? cur.filter((a) => a.id !== v.id) : [...cur, { id: v.id, name: v.name }]));
  const play = (url: string | null) => url && void new Audio(url).play();

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="key" value={type.key} />
      <input type="hidden" name="allowed_voices" value={JSON.stringify(allowed)} />
      <section className="surface grid gap-5 p-[22px] sm:grid-cols-2 sm:p-8">
        <Field label="שם הסוג">
          <Input name="name" defaultValue={type.name} required className={input} />
        </Field>
        <Field label="מטרה עיקרית">
          <Input name="purpose" defaultValue={type.purpose} className={input} />
        </Field>
        <Field
          label="פרומפט (תבנית הסוג)"
          hint="טון דיבור, אופי, מטרות והנחיות. בלי שם של עסק: פרטי העסק והידע של כל לקוח מתווספים אוטומטית."
          className="sm:col-span-2"
        >
          <Textarea name="prompt" defaultValue={type.prompt} rows={16} className="rounded-2xl text-[16px] leading-relaxed" />
        </Field>
      </section>

      <section className="surface grid gap-5 p-[22px] sm:grid-cols-2 sm:p-8">
        <h2 className="text-[20px] font-medium text-ink sm:col-span-2">מודל וקול</h2>
        {!connected && (
          <p className="-mt-3 rounded-2xl bg-warning-soft p-3 text-[15px] text-warning sm:col-span-2">
            ElevenLabs עוד לא מחובר (ELEVENLABS_API_KEY ב־Vercel), ולכן אין רשימות לבחירה.
          </p>
        )}
        {catalogError && <p className="-mt-3 rounded-2xl bg-destructive-soft p-3 text-[15px] text-destructive sm:col-span-2">{catalogError}</p>}
        <Field label="מודל שיחה (LLM)">
          {llms.length ? (
            <select name="llm_model" defaultValue={type.llm_model} className={selectCls} dir="ltr">
              <option value="">ברירת המחדל של ElevenLabs</option>
              {llms.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <Input name="llm_model" defaultValue={type.llm_model} dir="ltr" className={`${input} text-end`} placeholder="gemini-2.5-flash" />
          )}
        </Field>
        <Field label="מודל דיבור" hint="רק מודלים שמדברים עברית">
          <select name="tts_model" defaultValue={type.tts_model || "eleven_v4_turbo"} className={selectCls}>
            {HEBREW_TTS_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="קול ברירת מחדל" className="sm:col-span-2">
          {voices.length ? (
            <select name="default_voice_id" value={defaultVoice} onChange={(e) => setDefaultVoice(e.target.value)} className={selectCls}>
              <option value="">לא נבחר</option>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.description ? ` · ${v.description}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <Input name="default_voice_id" value={defaultVoice} onChange={(e) => setDefaultVoice(e.target.value)} dir="ltr" className={`${input} text-end`} placeholder="Voice ID" />
          )}
        </Field>
        {voices.length > 0 && (
          <div className="flex flex-col gap-3 sm:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[15px] font-medium text-ink">קולות שהלקוח יכול לבחור</p>
                <p className="text-[13px] text-ink-muted">נבחרו {allowed.length}</p>
              </div>
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="חיפוש קול" className="h-11 max-w-xs rounded-2xl" />
            </div>
            <ul className="grid max-h-80 gap-2 overflow-y-auto rounded-2xl bg-muted/50 p-2 sm:grid-cols-2">
              {shown.map((v) => {
                const on = allowed.some((a) => a.id === v.id);
                return (
                  <li key={v.id} className={cn("flex min-h-12 items-center gap-2 rounded-xl px-3", on ? "bg-tint" : "bg-card")}>
                    <label className="flex flex-1 cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={on} onChange={() => toggle(v)} className="size-4 accent-[var(--violet)]" />
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] text-ink">{v.name}</span>
                        {v.description && <span className="block truncate text-[12px] text-ink-muted">{v.description}</span>}
                      </span>
                    </label>
                    {v.previewUrl && (
                      <button type="button" onClick={() => play(v.previewUrl)} aria-label={`השמעת ${v.name}`} className="grid size-9 place-items-center rounded-full text-violet hover:bg-white">
                        <Play className="size-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="surface grid gap-5 p-[22px] sm:grid-cols-3 sm:p-8">
        <h2 className="text-[20px] font-medium text-ink sm:col-span-3">הגדרות דיבור</h2>
        <p className="-mt-3 text-[14px] text-ink-muted sm:col-span-3">ריק = ברירת המחדל של ElevenLabs.</p>
        <Field label="מהירות (0.7–1.2)">
          <Input name="speed" type="number" step="0.05" min="0.7" max="1.2" defaultValue={vs.speed} dir="ltr" className={`${input} text-end`} />
        </Field>
        <Field label="יציבות (0–1)">
          <Input name="stability" type="number" step="0.05" min="0" max="1" defaultValue={vs.stability} dir="ltr" className={`${input} text-end`} />
        </Field>
        <Field label="דמיון לקול (0–1)">
          <Input name="similarity_boost" type="number" step="0.05" min="0" max="1" defaultValue={vs.similarity_boost} dir="ltr" className={`${input} text-end`} />
        </Field>
        <Field label="התנהגות תורות">
          <select name="turn_eagerness" defaultValue={String(turn.turn_eagerness ?? "")} className={selectCls}>
            <option value="">רגיל (ברירת מחדל)</option>
            <option value="patient">סבלני</option>
            <option value="normal">רגיל</option>
            <option value="eager">מהיר</option>
          </select>
        </Field>
        <Field label="המתנה לתשובה (שניות)">
          <Input name="turn_timeout" type="number" step="1" min="1" max="30" defaultValue={turn.turn_timeout} dir="ltr" className={`${input} text-end`} />
        </Field>
        <Field label="ניתוק אחרי שקט (שניות)" hint="-1 = לא מנתק">
          <Input name="silence_end_call_timeout" type="number" step="1" min="-1" defaultValue={turn.silence_end_call_timeout} dir="ltr" className={`${input} text-end`} />
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

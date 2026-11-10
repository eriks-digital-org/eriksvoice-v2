"use client";

import { useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ds/kit";
import type { AgentTypeRow } from "@/lib/data/types";
import { HEBREW_TTS_MODELS, REALTIME_MODELS, type AllowedVoice } from "@/lib/voice/models";
import { saveAgentType, type SaveState } from "./actions";
import { VoicePicker, type ChosenVoice, type PickerVoice } from "./VoicePicker";


const selectCls = "h-12 w-full rounded-2xl border border-input bg-card px-3 text-[16px]";

export function TypeForm({
  type,
  voices,
  llms,
  connected,
  catalogError,
}: {
  type: AgentTypeRow & { allowed_voices: AllowedVoice[]; tts_model: string };
  voices: PickerVoice[];
  llms: string[];
  connected: boolean;
  catalogError?: string;
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveAgentType, {});
  const [allowed, setAllowed] = useState<ChosenVoice[]>(type.allowed_voices ?? []);
  const [defaultVoice, setDefaultVoice] = useState<ChosenVoice>({
    id: type.default_voice_id,
    name: type.allowed_voices?.find((v) => v.id === type.default_voice_id)?.name ?? type.default_voice_id,
  });
  const input = "h-12 rounded-2xl text-[16px]";
  const vs = (type.voice_settings ?? {}) as Record<string, number>;
  const turn = (type.conversation_settings ?? {}) as Record<string, string | number>;

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="key" value={type.key} />
      <input type="hidden" name="allowed_voices" value={JSON.stringify(allowed)} />
      <input type="hidden" name="default_voice_id" value={defaultVoice.id} />
      <input type="hidden" name="default_voice_name" value={defaultVoice.name} />
      <input type="hidden" name="default_voice_owner" value={defaultVoice.owner ?? ""} />
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
            ElevenLabs עוד לא מחובר (הגדרות ← ספקים), ולכן אין רשימות לבחירה.
          </p>
        )}
        {catalogError && <p className="-mt-3 rounded-2xl bg-destructive-soft p-3 text-[15px] text-destructive sm:col-span-2">{catalogError}</p>}
        <Field
          label="מצב דיבור"
          hint="Realtime: מודל אחד ששומע, חושב ומדבר, עם תגובה מהירה יותר. במצב הזה ElevenLabs בוחרים את מודל השיחה ומודל הדיבור, והקול נשאר מה שבחרתם."
          className="sm:col-span-2"
        >
          <select name="realtime_model" defaultValue={type.realtime_model ?? ""} className={selectCls}>
            <option value="">רגיל (מודל שיחה + מודל דיבור לבחירה)</option>
            {REALTIME_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="מודל שיחה (LLM)" hint="במצב Realtime לא בשימוש">
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
        <Field label="מודל דיבור" hint="רק מודלים שמדברים עברית. במצב Realtime לא בשימוש">
          <select name="tts_model" defaultValue={type.tts_model || "eleven_v4_turbo"} className={selectCls}>
            {HEBREW_TTS_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        {voices.length ? (
          <div className="sm:col-span-2">
            <VoicePicker
              voices={voices}
              allowed={allowed}
              onAllowed={setAllowed}
              defaultVoice={defaultVoice.id}
              onDefault={setDefaultVoice}
            />
          </div>
        ) : (
          <Field label="קול ברירת מחדל" className="sm:col-span-2">
            <Input value={defaultVoice.id} onChange={(e) => setDefaultVoice({ id: e.target.value, name: e.target.value })} dir="ltr" className={`${input} text-end`} placeholder="Voice ID" />
          </Field>
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

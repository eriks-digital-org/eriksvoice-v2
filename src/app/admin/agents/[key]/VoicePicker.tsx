"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PickerVoice {
  id: string;
  name: string;
  description: string;
  previewUrl: string | null;
  gender: "female" | "male" | "";
  source: "account" | "library";
  publicOwnerId?: string;
}

/** A chosen voice; `owner` is set for a library voice that is added to the account on save. */
export interface ChosenVoice {
  id: string;
  name: string;
  preview?: string | null;
  gender?: PickerVoice["gender"];
  owner?: string;
}

const genders = [
  { key: "", label: "הכל" },
  { key: "female", label: "אישה" },
  { key: "male", label: "גבר" },
] as const;

/**
 * One list for both choices: the star marks the default voice, the checkbox the voices
 * the client may pick. Hebrew voices only (the account's, then the public library's).
 */
export function VoicePicker({
  voices,
  allowed,
  onAllowed,
  defaultVoice,
  onDefault,
}: {
  voices: PickerVoice[];
  allowed: ChosenVoice[];
  onAllowed: (v: ChosenVoice[]) => void;
  defaultVoice: string;
  onDefault: (v: ChosenVoice) => void;
}) {
  const [q, setQ] = useState("");
  const [gender, setGender] = useState<"" | "female" | "male">("");
  const [onlyChosen, setOnlyChosen] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const chosen = (v: PickerVoice): ChosenVoice => ({ id: v.id, name: v.name, preview: v.previewUrl, gender: v.gender, ...(v.source === "library" ? { owner: v.publicOwnerId } : {}) });
  const isAllowed = (id: string) => allowed.some((a) => a.id === id);

  const shown = useMemo(() => {
    const f = q.trim().toLowerCase();
    return voices
      .filter((v) => !gender || v.gender === gender)
      .filter((v) => !f || `${v.name} ${v.description}`.toLowerCase().includes(f))
      .filter((v) => !onlyChosen || isAllowed(v.id) || v.id === defaultVoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voices, q, gender, onlyChosen, allowed, defaultVoice]);

  const toggle = (v: PickerVoice) => onAllowed(isAllowed(v.id) ? allowed.filter((a) => a.id !== v.id) : [...allowed, chosen(v)]);
  const star = (v: PickerVoice) => {
    onDefault(chosen(v));
    if (!isAllowed(v.id)) onAllowed([...allowed, chosen(v)]);
  };
  const play = (v: PickerVoice) => {
    audio.current?.pause();
    if (playing === v.id || !v.previewUrl) {
      setPlaying(null);
      return;
    }
    const a = new Audio(v.previewUrl);
    a.onended = () => setPlaying((p) => (p === v.id ? null : p));
    audio.current = a;
    setPlaying(v.id);
    void a.play().catch(() => setPlaying(null));
  };
  const defaultName = voices.find((v) => v.id === defaultVoice)?.name ?? allowed.find((a) => a.id === defaultVoice)?.name;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-medium text-ink">קולות</p>
        <p className="text-[13px] text-ink-muted">
          ⭐ = קול ברירת המחדל{defaultName ? ` (${defaultName})` : " (לא נבחר)"}. ☑ = קולות שהלקוח יכול לבחור, נבחרו {allowed.length}. מוצגים קולות בעברית בלבד.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש קול" className="h-11 max-w-xs flex-1 rounded-2xl" />
        <div className="flex gap-1 rounded-full bg-muted/60 p-1">
          {genders.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGender(g.key)}
              className={cn("min-h-9 rounded-full px-4 text-[14px]", gender === g.key ? "bg-card font-medium text-ink shadow-soft" : "text-ink-muted")}
            >
              {g.label}
            </button>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-[14px] text-ink-muted">
          <input type="checkbox" checked={onlyChosen} onChange={(e) => setOnlyChosen(e.target.checked)} className="size-4" />
          רק נבחרים
        </label>
      </div>
      <ul className="grid max-h-[28rem] gap-2 overflow-y-auto rounded-2xl bg-muted/50 p-2 sm:grid-cols-2">
        {shown.map((v) => {
          const on = isAllowed(v.id);
          const isDefault = v.id === defaultVoice;
          return (
            <li key={v.id} className={cn("flex min-h-14 items-center gap-1 rounded-xl px-2", on || isDefault ? "bg-tint" : "bg-card")}>
              <button
                type="button"
                onClick={() => play(v)}
                disabled={!v.previewUrl}
                aria-label={playing === v.id ? `עצירת ${v.name}` : `השמעת ${v.name}`}
                className="grid size-10 shrink-0 place-items-center rounded-full text-violet hover:bg-white disabled:opacity-30"
              >
                {playing === v.id ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input type="checkbox" checked={on} onChange={() => toggle(v)} className="size-4 shrink-0 accent-[var(--violet)]" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-ink">
                    {v.name}
                    {v.gender && <span className="text-[12px] text-ink-muted"> · {v.gender === "female" ? "אישה" : "גבר"}</span>}
                  </span>
                  <span className="block truncate text-[12px] text-ink-muted">
                    {[v.description, v.source === "library" ? "מהספרייה" : ""].filter(Boolean).join(" · ") || " "}
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => star(v)}
                aria-label={isDefault ? "קול ברירת המחדל" : `קביעת ${v.name} כברירת מחדל`}
                aria-pressed={isDefault}
                className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-white"
              >
                <Star className={cn("size-5", isDefault ? "fill-amber-400 text-amber-500" : "text-ink-soft")} />
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="p-4 text-[15px] text-ink-muted">אין קולות שמתאימים לסינון.</li>}
      </ul>
    </div>
  );
}

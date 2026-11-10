"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** Radio list of voices with play / stop, for the client portal. */
export function VoiceChoice({
  name,
  voices,
  defaultValue,
}: {
  name: string;
  voices: { id: string; name: string; preview?: string | null; gender?: string }[];
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const play = (id: string, url?: string | null) => {
    audio.current?.pause();
    if (playing === id || !url) return setPlaying(null);
    const a = new Audio(url);
    a.onended = () => setPlaying((p) => (p === id ? null : p));
    audio.current = a;
    setPlaying(id);
    void a.play().catch(() => setPlaying(null));
  };

  return (
    <ul className="grid gap-2 sm:grid-cols-2" role="radiogroup">
      {voices.map((v) => (
        <li key={v.id} className={cn("flex min-h-12 items-center gap-1 rounded-2xl px-2", value === v.id ? "bg-tint ring-2 ring-[#cbbcf8]" : "bg-muted/50")}>
          <button
            type="button"
            onClick={() => play(v.id, v.preview)}
            disabled={!v.preview}
            aria-label={playing === v.id ? `עצירת ${v.name}` : `השמעת ${v.name}`}
            className="grid size-10 shrink-0 place-items-center rounded-full text-violet hover:bg-white disabled:opacity-30"
          >
            {playing === v.id ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-2 text-[16px] text-ink">
            <input type="radio" name={name} value={v.id} checked={value === v.id} onChange={() => setValue(v.id)} className="size-4 accent-[var(--violet)]" />
            {v.name}
            {v.gender && <span className="text-[13px] text-ink-muted">{v.gender === "female" ? "אישה" : v.gender === "male" ? "גבר" : ""}</span>}
          </label>
        </li>
      ))}
    </ul>
  );
}

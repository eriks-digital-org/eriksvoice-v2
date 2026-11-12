"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { PronunciationRow } from "@/lib/voice/pronunciation";
import { savePronunciation, type PronunciationState } from "./actions";

type Row = PronunciationRow & { key: string };

let counter = 0;
const newKey = () => `new-${++counter}`;

export function PronunciationEditor({ rows: initial }: { rows: PronunciationRow[] }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((r) => ({ ...r, key: r.id ?? newKey() })));
  const [query, setQuery] = useState("");
  const [state, action, pending] = useActionState<PronunciationState, FormData>(savePronunciation, {});

  // After a save the rows come back with their ids, so new rows aren't added twice.
  const [savedRows, setSavedRows] = useState(state.rows);
  if (state.rows !== savedRows) {
    setSavedRows(state.rows);
    if (state.rows) setRows(state.rows.map((r) => ({ ...r, key: r.id ?? newKey() })));
  }

  const categories = useMemo(() => {
    const out: string[] = [];
    for (const r of rows) if (!out.includes(r.category)) out.push(r.category);
    return out;
  }, [rows]);

  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (category: string) =>
    setRows((rs) => {
      const row: Row = { key: newKey(), term: "", say: "", note: "", category, enabled: true };
      const last = rs.map((r) => r.category).lastIndexOf(category);
      return last < 0 ? [...rs, row] : [...rs.slice(0, last + 1), row, ...rs.slice(last + 1)];
    });

  const q = query.trim().toLowerCase();
  const visible = (r: Row) => !q || [r.term, r.say, r.note].some((v) => v.toLowerCase().includes(q));
  const payload = JSON.stringify(rows.map((r) => ({ id: r.id, term: r.term, say: r.say, note: r.note, category: r.category, enabled: r.enabled })));

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="rows" value={payload} />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חיפוש מילה"
        className="h-12 max-w-[420px] rounded-2xl text-[16px]"
      />
      {categories.map((cat) => {
        const list = rows.filter((r) => r.category === cat && visible(r));
        if (q && list.length === 0) return null;
        return (
          <section key={cat || "-"} className="surface flex flex-col gap-3 p-[22px] sm:p-8">
            <h2 className="text-[20px] font-medium text-ink">{cat || "כללי"}</h2>
            <div className="hidden grid-cols-[1fr_1fr_1fr_auto_auto] gap-3 px-1 text-[14px] text-ink-muted sm:grid">
              <span>המילה כפי שהסוכן כותב</span>
              <span>איך לומר (עם ניקוד)</span>
              <span>הערה (לא נשלחת)</span>
              <span>פעיל</span>
              <span />
            </div>
            {list.map((r) => (
              <div key={r.key} className="grid grid-cols-2 items-center gap-3 rounded-2xl bg-muted/40 p-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto] sm:bg-transparent sm:p-0">
                <Input
                  value={r.term}
                  onChange={(e) => set(r.key, { term: e.target.value })}
                  dir="auto"
                  aria-label="מילה"
                  placeholder="CRM"
                  className="h-11 rounded-xl text-[16px]"
                />
                <Input
                  value={r.say}
                  onChange={(e) => set(r.key, { say: e.target.value })}
                  dir="rtl"
                  aria-label="הגייה"
                  placeholder="סי. אָר. אֶם."
                  className="h-11 rounded-xl text-[17px]"
                />
                <Input
                  value={r.note}
                  onChange={(e) => set(r.key, { note: e.target.value })}
                  aria-label="הערה"
                  className="col-span-2 h-11 rounded-xl text-[15px] sm:col-span-1"
                />
                <Switch checked={r.enabled} onCheckedChange={(v) => set(r.key, { enabled: v })} aria-label="פעיל" />
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="grid size-10 place-items-center justify-self-end rounded-full text-ink-muted hover:bg-muted hover:text-destructive"
                  aria-label={`מחיקת ${r.term || "שורה"}`}
                >
                  <Trash2 className="size-[18px]" />
                </button>
              </div>
            ))}
            {!q && (
              <button
                type="button"
                onClick={() => add(cat)}
                className="flex min-h-10 items-center gap-2 self-start rounded-full px-3 text-[15px] font-medium text-ink hover:bg-muted"
              >
                <Plus className="size-[18px]" /> הוספת מילה
              </button>
            )}
          </section>
        );
      })}
      {!q && (
        <button
          type="button"
          onClick={() => {
            const name = window.prompt("שם הקבוצה החדשה")?.trim();
            if (name) add(name);
          }}
          className="flex min-h-11 items-center gap-2 self-start rounded-full bg-card px-4 text-[15px] font-medium text-ink shadow-soft"
        >
          <Plus className="size-[18px]" /> קבוצה חדשה
        </button>
      )}
      <div className="sticky bottom-4 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="cta-pill group">
          שמירה ועדכון הסוכנים
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

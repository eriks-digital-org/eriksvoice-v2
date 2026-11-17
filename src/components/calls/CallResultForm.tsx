import { RESULTS, type CallResult } from "./format";

/** Sets the business's result for a call (fixed list + short note). */
export function CallResultForm({
  action,
  fields,
  result,
  note,
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  result: CallResult | null;
  note: string;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="flex flex-col gap-1 text-[13px] text-ink-muted">
        תוצאה
        <select name="result" defaultValue={result ?? ""} className="min-h-11 rounded-[14px] border border-border bg-card px-3 text-[15px] text-ink">
          <option value="">בלי תוצאה</option>
          {Object.entries(RESULTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-[13px] text-ink-muted">
        פירוט קצר
        <input name="result_note" defaultValue={note} maxLength={300} placeholder="למשל: פגישה ביום שלישי ב־10:00" className="min-h-11 rounded-[14px] border border-border bg-card px-3 text-[15px] text-ink" />
      </label>
      <button className="min-h-11 rounded-[14px] bg-ink px-4 text-[15px] font-medium text-white">שמירה</button>
    </form>
  );
}

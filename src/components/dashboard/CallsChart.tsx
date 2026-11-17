import { RESULTS, type CallResult } from "@/components/calls/format";
import { israelDayStart } from "@/lib/time";

export interface ChartCall {
  started_at: string;
  duration_secs: number;
  status: string;
  direction: string;
  result: CallResult | null;
}

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

/** Calls per day (last N days, inbound/outbound stacked) and their results, for a business (results of the same period). */
export function CallsChart({ calls, days = 14 }: { calls: ChartCall[]; days?: number }) {
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = israelDayStart(new Date(), days - 1 - i);
    return { key: dayKey(d), label: d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric" }), inbound: 0, outbound: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const c of calls) {
    const i = index.get(dayKey(new Date(c.started_at)));
    if (i === undefined || c.direction === "web") continue;
    if (c.direction === "inbound") buckets[i].inbound++;
    else buckets[i].outbound++;
  }
  const max = Math.max(1, ...buckets.map((b) => b.inbound + b.outbound));
  const talked = calls.filter((c) => c.direction !== "web" && c.status !== "failed" && c.status !== "no_answer" && c.duration_secs > 0);
  const avg = talked.length ? Math.round(talked.reduce((s, c) => s + c.duration_secs, 0) / talked.length) : 0;
  const results = Object.entries(RESULTS)
    .map(([k, label]) => ({ label, n: calls.filter((c) => c.result === k).length }))
    .filter((r) => r.n > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[15px] text-ink-muted">
        <span>
          שיחות שנענו: <span className="num font-medium text-ink">{talked.length}</span>
        </span>
        <span>
          משך ממוצע: <span className="num font-medium text-ink">{`${Math.floor(avg / 60)}:${String(avg % 60).padStart(2, "0")}`}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-violet" aria-hidden /> נכנסות
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#9db8f5]" aria-hidden /> יוצאות
        </span>
      </div>
      <div className="flex h-40 items-end gap-1 sm:gap-2" role="img" aria-label="שיחות לפי יום">
        {buckets.map((b) => (
          <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${b.inbound} נכנסות, ${b.outbound} יוצאות`}>
            <div className="flex w-full max-w-8 flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${((b.inbound + b.outbound) / max) * 100}%` }}>
              <div className="bg-[#9db8f5]" style={{ flexGrow: b.outbound }} />
              <div className="bg-violet" style={{ flexGrow: b.inbound }} />
            </div>
            <span className="num hidden text-[11px] text-ink-muted sm:block">{b.label}</span>
          </div>
        ))}
      </div>
      {results.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {results.map((r) => (
            <li key={r.label} className="rounded-full bg-tint px-3 py-1.5 text-[14px] text-ink">
              {r.label}: <span className="num font-medium">{r.n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

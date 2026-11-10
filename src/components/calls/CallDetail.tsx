import { Pill } from "@/components/ds/StatusBadge";
import { Panel } from "@/components/ds/primitives";
import { StatTile } from "@/components/ds/kit";
import { directionLabel, duration, outcomeLabel, statusLabel, when, type CallFull } from "./format";

/** One call: recording, summary, collected data and the full transcript. */
export function CallDetail({ call }: { call: CallFull }) {
  const o = statusLabel[call.status] ?? outcomeLabel[call.outcome];
  const collected = Object.entries(call.collected ?? {}).filter(([, v]) => v !== null && v !== "");
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="מתי" value={<span className="num text-[20px]">{when(call.started_at)}</span>} />
        <StatTile label="משך" value={<span className="num">{duration(call.duration_secs)}</span>} />
        <StatTile label="כיוון" value={<span className="text-[20px]">{directionLabel[call.direction]}</span>} />
        <StatTile label="תוצאה" value={<Pill tone={o.tone}>{o.label}</Pill>} />
      </div>

      {call.has_audio && (
        <Panel title="הקלטה">
          <audio controls preload="none" src={`/api/calls/${call.id}/audio`} className="w-full" />
        </Panel>
      )}

      {call.end_reason && (
        <p className="rounded-2xl bg-tint p-4 text-[16px] text-ink">
          <span className="font-medium">איך השיחה הסתיימה: </span>
          {call.end_reason}
        </p>
      )}

      <Panel title="סיכום">
        <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-ink">{call.summary || "אין סיכום לשיחה הזו."}</p>
        {collected.length > 0 && (
          <dl className="mt-4 grid gap-2 sm:grid-cols-2">
            {collected.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-tint p-3">
                <dt className="text-[13px] text-ink-muted">{k}</dt>
                <dd className="text-[16px] text-ink">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <Panel title="תמלול">
        {call.transcript.length === 0 ? (
          <p className="text-[16px] text-ink-muted">אין תמלול.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {call.transcript.map((t, i) => (
              <li key={i} className={t.role === "agent" ? "flex justify-start" : "flex justify-end"}>
                <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-[16px] leading-relaxed ${t.role === "agent" ? "bg-tint text-ink" : "bg-ink text-white"}`}>
                  <span className="mb-1 block text-[12px] opacity-70">
                    {t.role === "agent" ? call.agent_name ?? "הסוכן" : "הלקוח"} · <span className="num">{duration(Math.round(t.at))}</span>
                  </span>
                  {t.text}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

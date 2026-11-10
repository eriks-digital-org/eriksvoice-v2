import Link from "next/link";
import { PhoneIncoming, PhoneOutgoing, MonitorSmartphone } from "lucide-react";
import { Pill } from "@/components/ds/StatusBadge";
import { StateBlock } from "@/components/ds/primitives";
import { CALLS_PAGE, directionLabel, duration, isLive, outcomeLabel, statusLabel, when, type CallListItem } from "./format";

const icon = { inbound: PhoneIncoming, outbound: PhoneOutgoing, web: MonitorSmartphone };

/** The list of calls, shared by the admin panel and the client portal. */
export function CallList({
  calls,
  hrefFor,
  page,
  pageHref,
  emptyText,
  hangup,
  hangupFields = {},
}: {
  calls: CallListItem[];
  hrefFor: (id: string) => string;
  page: number;
  pageHref: (page: number) => string;
  emptyText: string;
  /** Server action that hangs up a live call (gets "call_id" plus hangupFields). */
  hangup?: (form: FormData) => Promise<void>;
  hangupFields?: Record<string, string>;
}) {
  if (calls.length === 0 && page === 1) return <StateBlock kind="empty" title="עוד אין שיחות" description={emptyText} />;
  return (
    <>
      <ul className="divide-y divide-border">
        {calls.map((c) => {
          const Icon = icon[c.direction];
          const o = statusLabel[c.status] ?? outcomeLabel[c.outcome];
          const live = isLive(c.status);
          return (
            <li key={c.id} className="flex items-center transition-colors hover:bg-tint/60">
              <Link href={hrefFor(c.id)} className="flex min-h-[76px] min-w-0 flex-1 items-center gap-4 py-3 ps-[22px] pe-[22px] sm:ps-8 sm:pe-8">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-tint text-ink" title={directionLabel[c.direction]}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span dir="ltr" className="num truncate text-[17px] font-medium text-ink">
                      {c.external_number || directionLabel[c.direction]}
                    </span>
                    {c.client_name && <span className="truncate text-[14px] text-ink-muted">· {c.client_name}</span>}
                  </span>
                  <span className="block truncate text-[14px] text-ink-muted">
                    {c.agent_name ?? "סוכן שהוסר"} · {c.end_reason || c.summary || (live ? "השיחה עוד לא הסתיימה" : "אין סיכום")}
                  </span>
                </span>
                <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  <span className="num text-[14px] text-ink-muted">{when(c.started_at)}</span>
                  <span className="num text-[14px] text-ink-muted">{duration(c.duration_secs)}</span>
                </span>
                <Pill tone={o.tone}>{o.label}</Pill>
              </Link>
              {live && hangup && (
                <form action={hangup} className="shrink-0 pe-[22px] sm:pe-8">
                  <input type="hidden" name="call_id" value={c.id} />
                  {Object.entries(hangupFields).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                  <button className="min-h-10 rounded-full bg-destructive px-4 text-[14px] font-medium text-white">ניתוק</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {(page > 1 || calls.length === CALLS_PAGE) && (
        <div className="flex items-center justify-between px-[22px] py-4 text-[15px] sm:px-8">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="font-medium text-ink">
              → חדשות יותר
            </Link>
          ) : (
            <span />
          )}
          {calls.length === CALLS_PAGE && (
            <Link href={pageHref(page + 1)} className="font-medium text-ink">
              ישנות יותר ←
            </Link>
          )}
        </div>
      )}
    </>
  );
}

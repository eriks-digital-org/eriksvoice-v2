import Link from "next/link";
import { Download } from "lucide-react";
import { RESULTS } from "./format";
import { filterQuery, hasFilters, type CallFilters as Filters } from "@/lib/calls/queries";

const field = "min-h-11 rounded-[14px] border border-border bg-card px-3 text-[15px] text-ink";

/** Search and filters above a calls list (a plain GET form), with CSV export of the same filters. */
export function CallFilters({
  filters,
  agents,
  basePath,
  exportHref,
  hidden = {},
  exportParams = {},
}: {
  filters: Filters;
  agents: { id: string; name: string }[];
  basePath: string;
  /** export address without query; the filters are added */
  exportHref: string;
  /** extra fields kept on submit (e.g. the admin's client filter) */
  hidden?: Record<string, string>;
  /** extra params of the export address only (e.g. the portal's slug) */
  exportParams?: Record<string, string>;
}) {
  const exportQuery = filterQuery(filters, { ...hidden, ...exportParams });
  return (
    <form method="get" action={basePath} className="flex flex-wrap items-end gap-2 px-[22px] pt-5 sm:px-8">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="flex flex-col gap-1 text-[13px] text-ink-muted">
        טלפון
        <input name="q" defaultValue={filters.q ?? ""} inputMode="tel" dir="ltr" placeholder="050…" className={`${field} w-36`} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-ink-muted">
        כיוון
        <select name="direction" defaultValue={filters.direction ?? ""} className={field}>
          <option value="">הכול</option>
          <option value="inbound">נכנסות</option>
          <option value="outbound">יוצאות</option>
          <option value="web">בדיקות</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-ink-muted">
        תוצאה
        <select name="result" defaultValue={filters.result ?? ""} className={field}>
          <option value="">הכול</option>
          {Object.entries(RESULTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
          <option value="none">בלי תוצאה</option>
        </select>
      </label>
      {agents.length > 1 && (
        <label className="flex flex-col gap-1 text-[13px] text-ink-muted">
          סוכן
          <select name="agent" defaultValue={filters.agent ?? ""} className={field}>
            <option value="">כולם</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-[13px] text-ink-muted">
        מתאריך
        <input type="date" name="from" defaultValue={filters.from ?? ""} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-ink-muted">
        עד תאריך
        <input type="date" name="to" defaultValue={filters.to ?? ""} className={field} />
      </label>
      <button className="min-h-11 rounded-[14px] bg-ink px-4 text-[15px] font-medium text-white">סינון</button>
      {hasFilters(filters) && (
        <Link href={Object.keys(hidden).length ? `${basePath}?${filterQuery({}, hidden)}` : basePath} className="min-h-11 px-2 py-2.5 text-[15px] text-ink-muted">
          ניקוי
        </Link>
      )}
      <a href={`${exportHref}${exportQuery ? `?${exportQuery}` : ""}`} className="ms-auto inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-tint px-4 text-[15px] font-medium text-ink">
        <Download className="size-4" />
        ייצוא ל־CSV
      </a>
    </form>
  );
}

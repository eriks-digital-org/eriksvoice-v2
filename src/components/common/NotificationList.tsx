import Link from "next/link";
import { StateBlock } from "@/components/ds/primitives";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export function NotificationList({ items }: { items: NotificationItem[] }) {
  if (!items.length) return <StateBlock kind="empty" title="אין התראות" description="כשיקרה משהו שחשוב לדעת, הוא יופיע כאן." />;
  return (
    <ul className="divide-y divide-border">
      {items.map((n) => {
        const inner = (
          <>
            <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-violet")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className={cn("block text-[16px] text-ink", !n.read_at && "font-medium")}>{n.title}</span>
              {n.body && <span className="block text-[14px] text-ink-muted">{n.body}</span>}
            </span>
            <span className="num shrink-0 text-[13px] text-ink-muted">{when(n.created_at)}</span>
          </>
        );
        return (
          <li key={n.id}>
            {n.link ? (
              <Link href={n.link} className="flex items-start gap-3 px-[22px] py-4 hover:bg-tint/60 sm:px-8">
                {inner}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-[22px] py-4 sm:px-8">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

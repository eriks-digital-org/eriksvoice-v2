import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Inbox, Loader2, RotateCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Card surface with optional title row. */
export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode | undefined;
  subtitle?: React.ReactNode | undefined;
  action?: React.ReactNode | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
}) {
  return (
    <section className={cn("surface flex min-w-0 flex-col", className)}>
      {title && (
        <header className="flex items-start justify-between gap-3 px-[22px] pt-[22px] sm:px-8 sm:pt-7">
          <div className="min-w-0">
            <h2 className="truncate text-[20px] font-medium text-ink sm:text-[22px]">{title}</h2>
            {subtitle && <p className="mt-1 text-[15px] text-ink-muted">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("flex-1 p-[22px] sm:px-8 sm:py-6", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  soft,
  description,
  actions,
}: {
  title: string;
  /** Optional second phrase in the soft two-tone style of the v2 headings. */
  soft?: string | undefined;
  description?: string | undefined;
  actions?: React.ReactNode | undefined;
}) {
  return (
    <div className="fade-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[36px] font-medium leading-[1.08] tracking-[-0.02em] text-ink sm:text-[52px] lg:text-[60px]">
          {title}
          {soft && <span className="text-ink-soft"> {soft}</span>}
        </h1>
        {description && (
          <p className="mt-3 max-w-[720px] text-[17px] leading-relaxed text-ink-muted sm:text-[20px]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type StateKind = "empty" | "error" | "success" | "loading";
const stateIcon: Record<StateKind, LucideIcon> = {
  empty: Inbox,
  error: AlertTriangle,
  success: CheckCircle2,
  loading: Loader2,
};
const stateTone: Record<StateKind, string> = {
  empty: "bg-[linear-gradient(135deg,#ece6fe,#e2f8f1)] text-violet",
  error: "bg-destructive-soft text-destructive",
  success: "bg-success-soft text-success",
  loading: "bg-muted text-muted-foreground [&_svg]:animate-spin",
};

/** Unified empty / error / success block. */
export function StateBlock({
  kind,
  title,
  description,
  action,
}: {
  kind: StateKind;
  title: string;
  description?: string | undefined;
  action?: React.ReactNode | undefined;
}) {
  const Icon = stateIcon[kind];
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center sm:py-16">
      <div className={cn("mb-5 grid size-[72px] place-items-center rounded-full", stateTone[kind])}>
        <Icon className="size-7" strokeWidth={1.8} />
      </div>
      <h3 className="text-[21px] font-medium text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-[16px] leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function RetryLabel() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <RotateCw className="size-3.5" /> נסה שוב
    </span>
  );
}

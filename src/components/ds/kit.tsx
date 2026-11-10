"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Initials-based company logo. */
export function ClientLogo({
  initials,
  size = "md",
}: {
  initials: string;
  size?: "sm" | "md" | "lg" | undefined;
}) {
  const s = {
    sm: "size-9 text-[13px] rounded-full",
    md: "size-14 text-[19px] rounded-full",
    lg: "size-20 text-[28px] rounded-full",
  }[size];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-[linear-gradient(135deg,#d9cbff,#c7f0e6)] font-medium text-ink",
        s,
      )}
    >
      {initials}
    </span>
  );
}

/** Labelled form field. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label className="text-[15px] font-medium text-ink">{label}</Label>
      {children}
      {hint && <p className="text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Compact metric tile. */
export function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("min-w-0 rounded-[20px] bg-tint px-4 py-3.5 sm:px-5 sm:py-4", className)}>
      <p className="truncate text-[14px] text-ink-muted">{label}</p>
      <p className="num mt-1.5 text-start font-display text-[26px] font-medium leading-none text-ink sm:text-[30px]">
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-[13px] text-ink-soft">{hint}</p>}
    </div>
  );
}

export interface Option {
  value: string;
  label: string;
}

/** RTL select wrapper. */
export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <Select value={value} onValueChange={onChange} dir="rtl" disabled={disabled ?? false}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder ?? "בחירה"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string | undefined;
}) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border-2 border-transparent bg-tint ps-12 pe-4 text-[16px] text-ink outline-none placeholder:text-ink-soft focus:border-[#cbbcf8] focus:bg-card"
      />
    </label>
  );
}

/** Simple pagination footer. */
/** Page controls for a list the database pages. `page` is zero-based. */
export function PaginationBar({
  shown,
  total,
  page,
  pageSize,
  onPage,
}: {
  shown: number;
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : page * pageSize + 1;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 text-[14px] text-ink-muted sm:px-6">
      <span>
        מציג{" "}
        <span className="num">
          {first.toLocaleString()}–{(first + shown - (shown ? 1 : 0)).toLocaleString()}
        </span>{" "}
        מתוך <span className="num">{total.toLocaleString()}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          className="grid min-h-11 min-w-11 place-items-center rounded-full bg-tint px-3 text-ink hover:bg-accent disabled:opacity-50"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          הקודם
        </button>
        <span className="num px-2">
          {(page + 1).toLocaleString()} / {pages.toLocaleString()}
        </span>
        <button
          className="grid min-h-11 min-w-11 place-items-center rounded-full bg-tint px-3 text-ink hover:bg-accent disabled:opacity-50"
          disabled={page + 1 >= pages}
          onClick={() => onPage(page + 1)}
        >
          הבא
        </button>
      </div>
    </div>
  );
}

/** Small horizontal flow of chips: A ← B ← C (reads right-to-left). */
export function FlowChips({
  steps,
  className,
}: {
  steps: string[];
  className?: string | undefined;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {steps.map((s, i) => (
        <span key={`${s}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-muted-foreground" aria-hidden>
              ←
            </span>
          )}
          <span
            className={cn(
              "rounded-lg px-2 py-1 text-xs font-medium",
              i === 0 ? "bg-primary-soft text-primary" : "bg-muted",
            )}
          >
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}

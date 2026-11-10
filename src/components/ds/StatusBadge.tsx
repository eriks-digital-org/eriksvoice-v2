import { cn } from "@/lib/utils";

export type Tone = "success" | "info" | "warning" | "danger" | "neutral" | "lime";

const toneClass: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
  neutral: "bg-tint text-ink-muted",
  lime: "bg-[#e6f1ff] text-[#1f5fd6]",
};

/** Pill badge: the single status primitive used across the product. */
export function Pill({
  tone = "neutral",
  children,
  className,
  dot = true,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[14px] font-medium",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export type ClientStatus = "onboarding" | "active" | "paused";
const clientStatusMap: Record<ClientStatus, { label: string; tone: Tone }> = {
  active: { label: "פעיל", tone: "success" },
  paused: { label: "מושהה", tone: "warning" },
  onboarding: { label: "בהקמה", tone: "info" },
};
export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const s = clientStatusMap[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export type AgentStatus = "draft" | "active" | "paused";
const agentStatusMap: Record<AgentStatus, { label: string; tone: Tone }> = {
  active: { label: "פעיל", tone: "success" },
  paused: { label: "מושהה", tone: "warning" },
  draft: { label: "כבוי", tone: "neutral" },
};
export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const s = agentStatusMap[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export type ConnStatus = "off" | "requested" | "configured" | "connected" | "error";
const connMap: Record<ConnStatus, { label: string; tone: Tone }> = {
  off: { label: "לא מחובר", tone: "neutral" },
  requested: { label: "נשלחה בקשה", tone: "info" },
  configured: { label: "בבדיקה", tone: "warning" },
  connected: { label: "מחובר", tone: "success" },
  error: { label: "תקלה", tone: "danger" },
};
export function ConnBadge({ status }: { status: ConnStatus }) {
  const s = connMap[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

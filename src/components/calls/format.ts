export interface CallListItem {
  id: string;
  direction: "inbound" | "outbound" | "web";
  external_number: string;
  outcome: "success" | "failure" | "unknown";
  started_at: string;
  duration_secs: number;
  summary: string;
  status: string;
  end_reason: string;
  agent_name: string | null;
  client_name?: string | null;
}

export interface CallFull extends CallListItem {
  agent_number: string;
  has_audio: boolean;
  transcript: { role: "agent" | "user"; text: string; at: number }[];
  collected: Record<string, unknown>;
}

export const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const when = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export const directionLabel = { inbound: "נכנסת", outbound: "יוצאת", web: "בדיקה מהדפדפן" } as const;
export const outcomeLabel = {
  success: { label: "הצליחה", tone: "success" },
  failure: { label: "לא הצליחה", tone: "danger" },
  unknown: { label: "לא ידוע", tone: "neutral" },
} as const;

/** Calls that haven't ended (outbound calls being placed or in progress). */
export const isLive = (status: string) => status === "calling" || status === "ringing" || status === "in_progress";

/** The state shown for calls that didn't end as a normal conversation. */
export const statusLabel: Record<string, { label: string; tone: "info" | "danger" | "warning" }> = {
  calling: { label: "מחייגת", tone: "info" },
  ringing: { label: "מצלצלת", tone: "info" },
  in_progress: { label: "בשיחה עכשיו", tone: "info" },
  failed: { label: "נכשלה", tone: "danger" },
  no_answer: { label: "לא נענתה", tone: "warning" },
};

export const CALLS_PAGE = 30;

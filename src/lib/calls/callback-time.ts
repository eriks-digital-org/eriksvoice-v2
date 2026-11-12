/**
 * Call-backs: when a caller asks "תחזור אליי עוד X", the provider's post-call analysis
 * fills these fields, and we turn them into a time in Israel. Pure functions (no DB),
 * so they can be tested on their own.
 */
import { inWindow, israelNow } from "@/lib/time";

export const CALLBACK_FIELDS = {
  callback_requested: {
    type: "boolean",
    description:
      "true אם הלקוח ביקש במפורש שיחזרו אליו במועד אחר (למשל: 'תחזור אליי עוד שעה', 'תתקשרו מחר', 'עכשיו לא נוח, תחזרו אחר כך'). אחרת false.",
  },
  callback_in_minutes: {
    type: "integer",
    description:
      "רק אם הלקוח ביקש שיחזרו בעוד משך זמן: כמה דקות מסוף השיחה. 'עוד רבע שעה' = 15, 'עוד שעה' = 60, 'עוד שעתיים' = 120, 'עוד יומיים' = 2880, 'עוד שבוע' = 10080. ריק אם אמר יום או שעה ולא משך.",
  },
  callback_days_ahead: {
    type: "integer",
    description: "רק אם הלקוח אמר יום יחסי: היום = 0, מחר = 1, מחרתיים = 2. ריק אם לא אמר.",
  },
  callback_weekday: {
    type: "string",
    description: "רק אם הלקוח אמר יום בשבוע ('ביום שלישי'): sunday, monday, tuesday, wednesday, thursday, friday או saturday. ריק אם לא אמר.",
  },
  callback_time: {
    type: "string",
    description:
      "רק אם הלקוח אמר שעה או חלק ביום: השעה בפורמט HH:MM של 24 שעות. 'בבוקר' = 10:00, 'בצהריים' = 13:00, 'אחר הצהריים' = 16:00, 'בערב' = 18:00. ריק אם לא אמר.",
  },
  callback_note: {
    type: "string",
    description: "אם הלקוח ביקש שיחזרו אליו: מה בדיוק אמר על זה ולמה, במשפט קצר. ריק אם לא ביקש.",
  },
} as const;

export interface CallWindow {
  days: number[];
  start_minute: number;
  end_minute: number;
}

/** Calling hours when the client has no dialer settings: Sunday–Thursday 09:00–19:00. */
export const DEFAULT_WINDOW: CallWindow = { days: [0, 1, 2, 3, 4], start_minute: 540, end_minute: 1140 };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MAX_DAYS = 60;

const truthy = (v: unknown) => v === true || (typeof v === "string" && /^(true|yes|כן|1)$/i.test(v.trim()));
const int = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
};

/** The UTC instant of a wall-clock time in Israel (handles daylight saving). */
export function israelTime(y: number, m: number, d: number, hh: number, mm: number): Date {
  let t = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes: the offset can differ between the guess and the result around a DST change.
  for (let i = 0; i < 2; i++) {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(t));
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value);
    const shown = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
    t += Date.UTC(y, m - 1, d, hh, mm) - shown;
  }
  return new Date(t);
}

/** The Israel calendar date of an instant, as [year, month, day]. */
function israelDate(d: Date): [number, number, number] {
  const [y, m, day] = d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }).split("-").map(Number);
  return [y, m, day];
}

/** The first moment at or after `d` inside the calling hours (15-minute steps, up to 8 days). */
export function nextInWindow(d: Date, w: CallWindow): Date {
  if (!w.days.length || w.end_minute <= w.start_minute) return d;
  if (inWindow(w, d)) return d;
  // Jump to the next quarter hour, then walk.
  let t = new Date(Math.ceil(d.getTime() / 900_000) * 900_000);
  for (let i = 0; i < 8 * 96; i++) {
    if (inWindow(w, t)) return t;
    t = new Date(t.getTime() + 900_000);
  }
  return d;
}

/**
 * When to call back, from the call's collected fields and the time the call ended.
 * null when the caller did not ask for a call-back.
 */
export function callbackTime(collected: Record<string, unknown>, endedAt: Date, w: CallWindow = DEFAULT_WINDOW): Date | null {
  if (!truthy(collected.callback_requested)) return null;
  const minutes = int(collected.callback_in_minutes);
  const daysAhead = int(collected.callback_days_ahead);
  const weekday = WEEKDAYS.indexOf(String(collected.callback_weekday ?? "").trim().toLowerCase());
  const time = /^(\d{1,2}):(\d{2})$/.exec(String(collected.callback_time ?? "").trim());

  let due: Date;
  if (minutes !== null && minutes > 0) {
    due = new Date(endedAt.getTime() + Math.min(minutes, MAX_DAYS * 1440) * 60_000);
  } else {
    const [y, m, d] = israelDate(endedAt);
    const today = israelNow(endedAt).day;
    let ahead = 1; // asked without saying when: tomorrow
    if (daysAhead !== null && daysAhead >= 0) ahead = Math.min(daysAhead, MAX_DAYS);
    else if (weekday >= 0) ahead = (weekday - today + 7) % 7;
    else if (time) ahead = 0;
    const hh = time ? Math.min(23, Number(time[1])) : 10;
    const mm = time ? Math.min(59, Number(time[2])) : 0;
    // Date.UTC rolls the day over the month end.
    const day = new Date(Date.UTC(y, m - 1, d + ahead));
    due = israelTime(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hh, mm);
    // "At 10" said at 11 means tomorrow; "on Tuesday" said on a Tuesday afternoon, next week.
    if (due.getTime() <= endedAt.getTime()) {
      const plus = weekday >= 0 && daysAhead === null ? 7 : 1;
      const next = new Date(Date.UTC(y, m - 1, d + ahead + plus));
      due = israelTime(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), hh, mm);
    }
  }
  // Never right on top of the call that just ended.
  const earliest = new Date(endedAt.getTime() + 2 * 60_000);
  if (due < earliest) due = earliest;
  return nextInWindow(due, w);
}

/** Day of week (0 = Sunday) and minute of day, in Israel time. */
export function israelNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function inWindow(s: { days: number[]; start_minute: number; end_minute: number }, d = new Date()) {
  const { day, minute } = israelNow(d);
  return s.days.includes(day) && minute >= s.start_minute && minute < s.end_minute;
}

/** Midnight (Israel time) of the day `daysAgo` days before `d`, as a Date. */
export function israelDayStart(d = new Date(), daysAgo = 0): Date {
  const day = new Date(d.getTime() - daysAgo * 86400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  // Israel is UTC+2 or UTC+3: find the offset at that midnight.
  for (const off of [2, 3]) {
    const guess = new Date(`${day}T00:00:00+0${off}:00`);
    if (guess.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }) === day && israelNow(guess).minute === 0) return guess;
  }
  return new Date(`${day}T00:00:00+02:00`);
}

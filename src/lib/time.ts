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

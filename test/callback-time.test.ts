import { describe, expect, it } from "vitest";
import { callbackTime, DEFAULT_WINDOW } from "@/lib/calls/callback-time";
import { israelNow } from "@/lib/time";

// Tuesday 2026-11-17, 11:00 Israel (09:00 UTC)
const ended = new Date("2026-11-17T09:00:00Z");

describe("call-back time", () => {
  it("no request, no call-back", () => {
    expect(callbackTime({ callback_requested: false }, ended)).toBeNull();
    expect(callbackTime({}, ended)).toBeNull();
  });
  it("'in an hour'", () => {
    expect(callbackTime({ callback_requested: true, callback_in_minutes: 60 }, ended)?.toISOString()).toBe("2026-11-17T10:00:00.000Z");
  });
  it("'tomorrow' without an hour: 10:00 tomorrow", () => {
    expect(callbackTime({ callback_requested: true, callback_days_ahead: 1 }, ended)?.toISOString()).toBe("2026-11-18T08:00:00.000Z");
  });
  it("'at 10' said at 11: tomorrow at 10", () => {
    expect(callbackTime({ callback_requested: true, callback_time: "10:00" }, ended)?.toISOString()).toBe("2026-11-18T08:00:00.000Z");
  });
  it("'on Thursday at 16:00'", () => {
    expect(callbackTime({ callback_requested: true, callback_weekday: "thursday", callback_time: "16:00" }, ended)?.toISOString()).toBe("2026-11-19T14:00:00.000Z");
  });
  it("'on Tuesday' said on a Tuesday after 10: next Tuesday", () => {
    expect(callbackTime({ callback_requested: true, callback_weekday: "tuesday" }, ended)?.toISOString()).toBe("2026-11-24T08:00:00.000Z");
  });
  it("always inside the calling window", () => {
    // "in 10 hours" = 21:00 Tuesday, outside hours: moves to the next opening
    const due = callbackTime({ callback_requested: true, callback_in_minutes: 600 }, ended)!;
    const { day, minute } = israelNow(due);
    expect(DEFAULT_WINDOW.days).toContain(day);
    expect(minute).toBeGreaterThanOrEqual(DEFAULT_WINDOW.start_minute);
    expect(minute).toBeLessThan(DEFAULT_WINDOW.end_minute);
  });
  it("never right on top of the call that ended", () => {
    const due = callbackTime({ callback_requested: true, callback_in_minutes: 0, callback_days_ahead: 0, callback_time: "11:00" }, ended)!;
    expect(due.getTime()).toBeGreaterThanOrEqual(ended.getTime() + 2 * 60_000);
  });
});

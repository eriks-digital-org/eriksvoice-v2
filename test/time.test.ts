import { describe, expect, it } from "vitest";
import { inWindow, israelDayStart, israelNow } from "@/lib/time";

const BUSINESS = { days: [0, 1, 2, 3, 4], start_minute: 9 * 60, end_minute: 19 * 60 };

describe("israel time", () => {
  it("reads day and minute in Israel (winter, UTC+2)", () => {
    // Tuesday 2026-11-17 08:30 UTC = 10:30 Israel
    expect(israelNow(new Date("2026-11-17T08:30:00Z"))).toEqual({ day: 2, minute: 10 * 60 + 30 });
  });
  it("reads day and minute in Israel (summer, UTC+3)", () => {
    // Monday 2026-07-06 21:30 UTC = Tuesday 00:30 Israel
    expect(israelNow(new Date("2026-07-06T21:30:00Z"))).toEqual({ day: 2, minute: 30 });
  });
  it("calling window: inside and outside", () => {
    expect(inWindow(BUSINESS, new Date("2026-11-17T08:30:00Z"))).toBe(true); // Tue 10:30
    expect(inWindow(BUSINESS, new Date("2026-11-17T17:30:00Z"))).toBe(false); // Tue 19:30
    expect(inWindow(BUSINESS, new Date("2026-11-20T08:30:00Z"))).toBe(false); // Friday
  });
  it("midnight of today and of past days", () => {
    expect(israelDayStart(new Date("2026-11-17T08:30:00Z")).toISOString()).toBe("2026-11-16T22:00:00.000Z");
    expect(israelDayStart(new Date("2026-11-17T08:30:00Z"), 1).toISOString()).toBe("2026-11-15T22:00:00.000Z");
    expect(israelDayStart(new Date("2026-07-07T08:00:00Z")).toISOString()).toBe("2026-07-06T21:00:00.000Z");
    // 23:30 UTC is already the next day in Israel
    expect(israelDayStart(new Date("2026-11-17T23:30:00Z")).toISOString()).toBe("2026-11-17T22:00:00.000Z");
  });
});

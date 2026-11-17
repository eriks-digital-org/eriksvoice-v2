import { describe, expect, it } from "vitest";
import { parseEvents, syncUrl } from "@/lib/calltools/calendar";

describe("calendar flow", () => {
  it("calls the synchronous webhook address once", () => {
    expect(syncUrl("https://voice.eriks.co.il/api/v1/webhooks/abc")).toBe("https://voice.eriks.co.il/api/v1/webhooks/abc/sync");
    expect(syncUrl("https://voice.eriks.co.il/api/v1/webhooks/abc/")).toBe("https://voice.eriks.co.il/api/v1/webhooks/abc/sync");
    expect(syncUrl("https://voice.eriks.co.il/api/v1/webhooks/abc/sync")).toBe("https://voice.eriks.co.il/api/v1/webhooks/abc/sync");
  });

  it("reads Google Calendar items and skips cancelled ones", () => {
    const raw = {
      items: [
        { id: "a", summary: "פגישה", description: "טלפון: 0501234567", start: { dateTime: "2026-11-18T10:00:00+02:00" }, end: { dateTime: "2026-11-18T10:30:00+02:00" } },
        { id: "b", status: "cancelled", start: { dateTime: "2026-11-18T11:00:00+02:00" }, end: { dateTime: "2026-11-18T11:30:00+02:00" } },
      ],
    };
    const ev = parseEvents(raw);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ id: "a", title: "פגישה", start: Date.parse("2026-11-18T08:00:00Z"), end: Date.parse("2026-11-18T08:30:00Z") });
  });

  it("accepts a plain list, a wrapped body and missing ends", () => {
    expect(parseEvents([{ id: "x", start: "2026-11-18T08:00:00Z" }])[0].end).toBe(Date.parse("2026-11-18T08:30:00Z"));
    expect(parseEvents({ body: { items: [{ id: "y", start: { date: "2026-11-19" }, end: { date: "2026-11-20" } }] } })).toHaveLength(1);
    expect(parseEvents({ events: [{ title: "no start" }] })).toEqual([]);
    expect(parseEvents("ok")).toEqual([]);
  });
});

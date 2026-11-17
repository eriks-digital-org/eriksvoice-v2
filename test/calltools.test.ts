import { describe, expect, it } from "vitest";
import { contactPhone, fitsWindow, freeSlots, parseIsraelTime } from "@/lib/calltools/handlers";
import { toolConfig } from "@/lib/calltools/provider";
import { CALL_TOOLS, WEBHOOK_TOOLS } from "@/lib/calltools/definitions";
import { HANDLERS } from "@/lib/calltools/handlers";

const W = { days: [0, 1, 2, 3, 4], start_minute: 9 * 60, end_minute: 19 * 60 };

describe("meeting slots", () => {
  it("parses Israel wall time", () => {
    expect(parseIsraelTime("2026-11-18 10:00")?.toISOString()).toBe("2026-11-18T08:00:00.000Z");
    expect(parseIsraelTime("2026-07-01T10:30")?.toISOString()).toBe("2026-07-01T07:30:00.000Z");
    expect(parseIsraelTime("tomorrow")).toBeNull();
  });
  it("a meeting must end inside the hours", () => {
    expect(fitsWindow(parseIsraelTime("2026-11-18 18:30")!, 30, W)).toBe(true);
    expect(fitsWindow(parseIsraelTime("2026-11-18 18:45")!, 30, W)).toBe(false);
    expect(fitsWindow(parseIsraelTime("2026-11-20 10:00")!, 30, W)).toBe(false); // Friday
  });
  it("skips booked times and the next hour", () => {
    const now = parseIsraelTime("2026-11-18 09:10")!;
    const busy = [{ start: parseIsraelTime("2026-11-18 10:30")!.getTime(), end: parseIsraelTime("2026-11-18 11:00")!.getTime() }];
    const slots = freeSlots({ from: now, days: 1, minutes: 30, window: W, busy, limit: 4, now });
    const israel = slots.map((s) => s.toLocaleTimeString("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }));
    expect(israel).toEqual(["11:00", "11:30", "12:00", "12:30"]);
  });
});

describe("who is on the line", () => {
  const own = ["+97231234567"];
  it("inbound: the caller", () => expect(contactPhone("0501234567", "+97231234567", own)).toBe("+972501234567"));
  it("outbound: the called number", () => expect(contactPhone("+97231234567", "+972521111111", own)).toBe("+972521111111"));
  it("browser test: nobody", () => expect(contactPhone("", "", own)).toBe(""));
});

describe("tool definitions", () => {
  it("every webhook tool has a handler, and the system fills who and which call", () => {
    for (const t of WEBHOOK_TOOLS) {
      expect(HANDLERS[t.name]).toBeTypeOf("function");
      const c = toolConfig(t, "s3cret");
      expect(c.api_schema.url).toMatch(/\/api\/public\/voice\/tools\//);
      expect(c.api_schema.request_body_schema.properties.agent_id).toEqual({ type: "string", dynamic_variable: "system__agent_id" });
      expect(c.api_schema.request_headers["X-EriksVoice-Key"]).toBe("s3cret");
      for (const r of c.api_schema.request_body_schema.required) expect(c.api_schema.request_body_schema.properties[r]).toBeDefined();
    }
  });
  it("names are unique", () => {
    expect(new Set(CALL_TOOLS.map((t) => t.name)).size).toBe(CALL_TOOLS.length);
  });
});

import { nextBuildStatus } from "@/lib/automations/build";
import { EMPTY_SPEC, type AutomationSpec } from "@/lib/automations/catalog";

describe("automation build status", () => {
  const plain: AutomationSpec = { ...EMPTY_SPEC, actions: [{ type: "notify_team", config: {} }] };
  const ap: AutomationSpec = { ...EMPTY_SPEC, actions: [{ type: "activepieces", config: { action: "gmail_send" } }] };
  it("our own actions are ready at once", () => {
    expect(nextBuildStatus(plain)).toEqual({ status: "ready", notify: false });
  });
  it("an Activepieces action is sent to the office once", () => {
    expect(nextBuildStatus(ap)).toEqual({ status: "pending", notify: true });
    expect(nextBuildStatus(ap, { spec: ap, build_status: "pending" })).toEqual({ status: "pending", notify: false });
    expect(nextBuildStatus({ ...ap, delay_minutes: 5 }, { spec: ap, build_status: "built" })).toEqual({ status: "built", notify: false });
  });
  it("changing the Activepieces part sends it again", () => {
    const changed: AutomationSpec = { ...EMPTY_SPEC, actions: [{ type: "activepieces", config: { action: "sheets_append" } }] };
    expect(nextBuildStatus(changed, { spec: ap, build_status: "built" })).toEqual({ status: "pending", notify: true });
    expect(nextBuildStatus(ap, { spec: plain, build_status: "ready" })).toEqual({ status: "pending", notify: true });
  });
});

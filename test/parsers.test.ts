import { describe, expect, it } from "vitest";
import { toE164 } from "@/lib/phone";
import { parseCsv } from "@/lib/csv";
import { parseSpec } from "@/lib/automations/validate";
import { render } from "@/lib/automations/catalog";
import { filterQuery, parseFilters } from "@/lib/calls/queries";

describe("phones", () => {
  it("Israeli formats become E.164", () => {
    expect(toE164("050-123-4567")).toBe("+972501234567");
    expect(toE164("+972 50 123 4567")).toBe("+972501234567");
    expect(toE164("00972501234567")).toBe("+972501234567");
    expect(toE164("03-1234567")).toBe("+97231234567");
    expect(toE164("501234567")).toBe("+972501234567");
  });
  it("garbage is rejected", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("abc")).toBeNull();
    expect(toE164("12")).toBeNull();
  });
});

describe("csv", () => {
  it("commas, quotes and Hebrew", () => {
    expect(parseCsv('שם,טלפון\n"כהן, דנה",0501234567\n')).toEqual([
      ["שם", "טלפון"],
      ["כהן, דנה", "0501234567"],
    ]);
  });
  it("semicolons and a BOM", () => {
    expect(parseCsv("﻿a;b\r\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("automation spec", () => {
  const base = { trigger: { type: "lead_new", config: {} }, actions: [{ type: "notify_team", config: { text: "hi" } }] };
  it("a valid spec is cleaned", () => {
    const r = parseSpec(JSON.stringify({ ...base, delay_minutes: 99999 }));
    expect("spec" in r && r.spec.delay_minutes).toBe(10080);
  });
  it("unknown action and http address are refused", () => {
    expect(parseSpec(JSON.stringify({ ...base, actions: [{ type: "rm -rf", config: {} }] }))).toHaveProperty("error");
    expect(parseSpec(JSON.stringify({ ...base, actions: [{ type: "webhook", config: { url: "http://x.y" } }] }))).toHaveProperty("error");
  });
  it("too many actions are refused", () => {
    expect(parseSpec(JSON.stringify({ ...base, actions: Array(9).fill(base.actions[0]) }))).toHaveProperty("error");
  });
  it("placeholders", () => {
    expect(render("שלום {{name}}, {{missing}}!", { name: "דנה" })).toBe("שלום דנה, !");
  });
});

describe("call filters", () => {
  it("keeps only valid values", () => {
    expect(
      parseFilters({ q: "050-12", direction: "inbound", result: "meeting", agent: "x", from: "2026-11-01", to: "nope" }),
    ).toEqual({ q: "05012", direction: "inbound", result: "meeting", from: "2026-11-01" });
    expect(parseFilters({ result: "hack" })).toEqual({});
  });
  it("round-trips through the address", () => {
    expect(filterQuery({ direction: "outbound" }, { page: 2 })).toBe("direction=outbound&page=2");
  });
});

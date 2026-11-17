import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifySignature } from "@/lib/calls/ingest";
import { toProviderRules } from "@/lib/voice/pronunciation";

describe("voice webhook signature", () => {
  const secret = "wsec_test";
  const body = '{"type":"post_call_transcription"}';
  const sign = (t: number, b = body, s = secret) => `t=${t},v0=${createHmac("sha256", s).update(`${t}.${b}`).digest("hex")}`;
  const now = Math.floor(Date.now() / 1000);
  it("accepts a fresh, correct signature", () => {
    expect(verifySignature(sign(now), body, secret)).toBe(true);
  });
  it("refuses a wrong secret, a changed body, an old timestamp or no header", () => {
    expect(verifySignature(sign(now, body, "other"), body, secret)).toBe(false);
    expect(verifySignature(sign(now), body + " ", secret)).toBe(false);
    expect(verifySignature(sign(now - 3600), body, secret)).toBe(false);
    expect(verifySignature(null, body, secret)).toBe(false);
  });
});

describe("pronunciation rules", () => {
  it("adds case forms, skips off rules and duplicates, longest first", () => {
    const rules = toProviderRules([
      { term: "lead", say: "ליד", note: "", category: "", enabled: true },
      { term: "landing page", say: "דף נחיתה", note: "", category: "", enabled: true },
      { term: "CRM", say: "סי אר אם", note: "", category: "", enabled: true },
      { term: "Lead", say: "other", note: "", category: "", enabled: true },
      { term: "off", say: "x", note: "", category: "", enabled: false },
    ]);
    expect(rules.map((r) => r.string_to_replace)).toEqual(["landing page", "Landing page", "lead", "Lead", "CRM"]);
    expect(rules.find((r) => r.string_to_replace === "Lead")?.alias).toBe("ליד");
  });
});

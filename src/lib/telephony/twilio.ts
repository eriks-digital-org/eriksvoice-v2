import "server-only";
import { getSecret } from "@/lib/providers/secrets";

/** Twilio account (numbers are bought there manually, then assigned to one business here). */
export const isTwilioConfigured = async () => Boolean((await getSecret("twilio_account_sid")) && (await getSecret("twilio_auth_token")));

export async function twilioCredentials() {
  const sid = await getSecret("twilio_account_sid");
  const token = await getSecret("twilio_auth_token");
  if (!sid || !token) throw new Error("Twilio עוד לא מחובר. מגדירים בהגדרות ← ספקים.");
  return { sid, token };
}

export interface OwnedNumber {
  sid: string;
  number: string;
  friendly: string;
  voice: boolean;
}

export async function listOwnedNumbers(): Promise<OwnedNumber[]> {
  const { sid, token } = await twilioCredentials();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PageSize=200`, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw new Error("Twilio לא הגיב. נסו שוב.");
  if (res.status === 401) throw new Error("פרטי Twilio לא נכונים.");
  if (!res.ok) throw new Error(`Twilio החזיר שגיאה (${res.status})`);
  const j = (await res.json()) as {
    incoming_phone_numbers?: { sid: string; phone_number: string; friendly_name: string; capabilities?: { voice?: boolean } }[];
  };
  return (j.incoming_phone_numbers ?? []).map((n) => ({
    sid: n.sid,
    number: n.phone_number,
    friendly: n.friendly_name,
    voice: Boolean(n.capabilities?.voice),
  }));
}

/** Sends an SMS from one of the account's numbers. */
export async function sendSms(from: string, to: string, body: string): Promise<void> {
  const { sid, token } = await twilioCredentials();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body.slice(0, 1500) }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res) throw new Error("Twilio לא הגיב");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Twilio: ${j.message ?? res.status}`);
  }
}

const auth = (sid: string, token: string) => `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;

export interface TwilioCall {
  status: "queued" | "ringing" | "in-progress" | "completed" | "busy" | "failed" | "no-answer" | "canceled";
  duration: number;
}

/** A call's current state at Twilio, or null when Twilio doesn't know it. */
export async function getTwilioCall(callSid: string): Promise<TwilioCall | null> {
  const { sid, token } = await twilioCredentials();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${encodeURIComponent(callSid)}.json`, {
    headers: { Authorization: auth(sid, token) },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return null;
  const j = (await res.json()) as { status: TwilioCall["status"]; duration?: string | null };
  return { status: j.status, duration: Number(j.duration) || 0 };
}

/** Ends a live call. */
export async function hangupTwilioCall(callSid: string): Promise<void> {
  const { sid, token } = await twilioCredentials();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${encodeURIComponent(callSid)}.json`, {
    method: "POST",
    headers: { Authorization: auth(sid, token), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ Status: "completed" }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res) throw new Error("Twilio לא הגיב");
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Twilio: ${j.message ?? res.status}`);
  }
}

const KNOWN_ERRORS: Record<string, string> = {
  "13227": "בחשבון Twilio אין הרשאה לחייג למדינה הזו (Voice Geographic Permissions)",
  "21215": "בחשבון Twilio אין הרשאה לחייג למדינה הזו (Voice Geographic Permissions)",
  "21219": "חשבון Twilio בתקופת ניסיון מחייג רק למספרים מאומתים",
  "21210": "מספר המתקשר לא מאומת ב־Twilio",
  "13224": "מספר היעד לא תקין",
  "13225": "Twilio חסם את היעד (מספר בסיכון הונאה)",
  "21211": "מספר היעד לא תקין",
};

/** Twilio's own explanation of a failed call (from its error log), in Hebrew when known. */
export async function twilioCallError(callSid: string): Promise<string> {
  const { sid, token } = await twilioCredentials();
  const res = await fetch(`https://monitor.twilio.com/v1/Alerts?ResourceSid=${encodeURIComponent(callSid)}&PageSize=5`, {
    headers: { Authorization: auth(sid, token) },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return "";
  const j = (await res.json()) as { alerts?: { error_code?: string; alert_text?: string }[] };
  const a = j.alerts?.[0];
  if (!a?.error_code) return "";
  const msg = new URLSearchParams(a.alert_text ?? "").get("Msg");
  return KNOWN_ERRORS[a.error_code] ? `${KNOWN_ERRORS[a.error_code]} (Twilio ${a.error_code})` : `Twilio ${a.error_code}${msg ? `: ${msg}` : ""}`;
}

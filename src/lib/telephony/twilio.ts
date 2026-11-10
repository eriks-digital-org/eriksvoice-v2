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

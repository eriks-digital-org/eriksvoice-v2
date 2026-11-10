import "server-only";

/** Twilio account (numbers are bought there manually, then assigned to one business here). */
export const isTwilioConfigured = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

export function twilioCredentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio עוד לא מחובר (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).");
  return { sid, token };
}

export interface OwnedNumber {
  sid: string;
  number: string;
  friendly: string;
  voice: boolean;
}

export async function listOwnedNumbers(): Promise<OwnedNumber[]> {
  const { sid, token } = twilioCredentials();
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

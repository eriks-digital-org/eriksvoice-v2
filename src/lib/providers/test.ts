import "server-only";
import { getSecret } from "./secrets";
import type { ProviderDef } from "./registry";

export type TestResult = { ok: boolean; message: string };

const get = async (url: string, headers: Record<string, string>) =>
  fetch(url, { headers, signal: AbortSignal.timeout(15_000), cache: "no-store" }).catch(() => null);

/** A light read-only call per provider, to check the saved keys work. */
export async function testProvider(key: ProviderDef["key"]): Promise<TestResult> {
  switch (key) {
    case "elevenlabs": {
      const k = await getSecret("elevenlabs_api_key");
      if (!k) return { ok: false, message: "אין מפתח" };
      const r = await get("https://api.elevenlabs.io/v2/voices?page_size=1", { "xi-api-key": k });
      if (!r) return { ok: false, message: "ElevenLabs לא הגיב" };
      if (r.ok) return { ok: true, message: "המפתח עובד" };
      const body = await r.text();
      if (body.includes("API key ID")) return { ok: false, message: "הוזן מזהה המפתח ולא המפתח עצמו (שמתחיל ב־sk_)" };
      if (body.includes("missing_permissions")) return { ok: false, message: "למפתח חסרות הרשאות (Voices / Agents)" };
      return { ok: false, message: `המפתח נדחה (${r.status})` };
    }
    case "twilio": {
      const sid = await getSecret("twilio_account_sid");
      const token = await getSecret("twilio_auth_token");
      if (!sid || !token) return { ok: false, message: "חסרים Account SID או Auth Token" };
      const r = await get(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      });
      if (!r) return { ok: false, message: "Twilio לא הגיב" };
      return r.ok ? { ok: true, message: "הפרטים עובדים" } : { ok: false, message: `Twilio דחה את הפרטים (${r.status})` };
    }
    case "utobo": {
      const k = await getSecret("utobo_api_key");
      // Utobo has no read-only endpoint we can call without sending mail.
      return k ? { ok: true, message: "המפתח שמור. הבדיקה המלאה היא שליחת מייל." } : { ok: false, message: "אין מפתח" };
    }
    case "activepieces": {
      const url = (await getSecret("activepieces_url"))?.replace(/\/+$/, "");
      if (!url) return { ok: false, message: "אין כתובת" };
      const r = await get(`${url}/api/v1/flags`, {});
      if (!r) return { ok: false, message: "השרת לא הגיב" };
      if (!r.ok) return { ok: false, message: `השרת החזיר ${r.status}` };
      return { ok: true, message: "השרת זמין" };
    }
  }
}

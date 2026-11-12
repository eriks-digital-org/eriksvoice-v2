import "server-only";
import { getSecret } from "./secrets";
import { sendMail } from "@/lib/notify/mail";
import type { ProviderDef } from "./registry";

export type TestResult = { ok: boolean; message: string };

const get = async (url: string, headers: Record<string, string>) =>
  fetch(url, { headers, signal: AbortSignal.timeout(15_000), cache: "no-store" }).catch(() => null);

/** A light read-only call per provider, to check the saved keys work. */
export async function testProvider(key: ProviderDef["key"], adminEmail?: string): Promise<TestResult> {
  switch (key) {
    case "elevenlabs": {
      const k = await getSecret("elevenlabs_api_key");
      if (!k) return { ok: false, message: "אין מפתח" };
      const r = await get("https://api.elevenlabs.io/v2/voices?page_size=1", { "xi-api-key": k });
      if (!r) return { ok: false, message: "ElevenLabs לא הגיב" };
      if (r.ok) {
        const agents = await get("https://api.elevenlabs.io/v1/convai/agents?page_size=1", { "xi-api-key": k });
        if (agents && !agents.ok) return { ok: false, message: `קולות עובדים, אבל אין הרשאה לסוכנים (Agents): ${(await agents.text()).slice(0, 160)}` };
        return { ok: true, message: "המפתח עובד (קולות וסוכנים)" };
      }
      const body = await r.text();
      if (body.includes("API key ID")) return { ok: false, message: "הוזן מזהה המפתח ולא המפתח עצמו (שמתחיל ב־sk_)" };
      if (body.includes("missing_permissions")) return { ok: false, message: `למפתח חסרות הרשאות: ${body.slice(0, 200)}` };
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
      if (!k) return { ok: false, message: "אין מפתח" };
      if (!adminEmail) return { ok: true, message: "המפתח שמור" };
      // Utobo has no read-only endpoint, so the test is a real email to the admin.
      const sent = await sendMail([adminEmail], "בדיקת מייל מ־EriksVoice", "אם המייל הזה הגיע, שליחת המיילים מהמערכת עובדת.");
      return sent
        ? { ok: true, message: `נשלח מייל בדיקה ל־${adminEmail}` }
        : { ok: false, message: "השליחה נכשלה. בודקים את המפתח ושהדומיין eriksvoice.co.il מאומת ב־Utobo." };
    }
    case "erikscrm": {
      const url = (await getSecret("erikscrm_base_url"))?.replace(/\/+$/, "");
      if (!url) return { ok: false, message: "אין כתובת" };
      // Without a key the API answers 401 in JSON; a website answers HTML.
      const r = await get(`${url}/statuses`, {});
      if (!r) return { ok: false, message: "הכתובת לא הגיבה" };
      const type = r.headers.get("content-type") ?? "";
      if (!type.includes("json")) return { ok: false, message: "הכתובת מחזירה דף אתר ולא API. צריך את כתובת הפונקציה עצמה" };
      return r.status === 401 ? { ok: true, message: "ה־API עונה. את המפתח של כל עסק מזינים בדף הלקוח" } : { ok: true, message: `ה־API עונה (${r.status})` };
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

/** The external services whose keys the admin manages from the panel (Settings → Providers). */
export interface ProviderField {
  /** Vault name (stored as ev_<name>). */
  name: string;
  /** Environment variable used when no value was set in the panel. */
  env: string;
  label: string;
  /** Secret values are never shown back, only their last 4 characters. */
  secret: boolean;
  placeholder?: string;
  hint?: string;
  /** Not needed for the provider to count as set up. */
  optional?: boolean;
}

export interface ProviderDef {
  key: "elevenlabs" | "twilio" | "utobo" | "activepieces" | "erikscrm";
  name: string;
  purpose: string;
  fields: ProviderField[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    key: "elevenlabs",
    name: "ElevenLabs",
    purpose: "הסוכנים הקוליים, הקולות, השיחות וההקלטות",
    fields: [
      { name: "elevenlabs_api_key", env: "ELEVENLABS_API_KEY", label: "API Key", secret: true, placeholder: "sk_…", hint: "Developers ← API Keys. מתחיל ב־sk_" },
      {
        name: "elevenlabs_webhook_secret",
        env: "ELEVENLABS_WEBHOOK_SECRET",
        label: "Webhook secret",
        secret: true,
        placeholder: "wsec_…",
        hint: "Agents ← Settings ← Webhooks, לכתובת https://eriksvoice.co.il/api/public/voice/webhook",
      },
      {
        name: "elevenlabs_initiation_secret",
        env: "ELEVENLABS_INITIATION_SECRET",
        label: "סוד לזיהוי מתקשר",
        secret: true,
        optional: true,
        hint: "סוד שבוחרים בעצמכם. ב־Agents ← Settings מגדירים Conversation initiation webhook לכתובת https://eriksvoice.co.il/api/public/voice/initiation עם כותרת X-EriksVoice-Key והסוד הזה",
      },
    ],
  },
  {
    key: "twilio",
    name: "Twilio",
    purpose: "מספרי הטלפון",
    fields: [
      { name: "twilio_account_sid", env: "TWILIO_ACCOUNT_SID", label: "Account SID", secret: false, placeholder: "AC…" },
      { name: "twilio_auth_token", env: "TWILIO_AUTH_TOKEN", label: "Auth Token", secret: true },
    ],
  },
  {
    key: "utobo",
    name: "Utobo",
    purpose: "שליחת מיילים מהמערכת",
    fields: [{ name: "utobo_api_key", env: "UTOBO_API_KEY", label: "API Key", secret: true }],
  },
  {
    key: "activepieces",
    name: "Activepieces",
    purpose: "האוטומציות והחיבורים של הלקוחות",
    fields: [
      { name: "activepieces_url", env: "ACTIVEPIECES_URL", label: "כתובת", secret: false, placeholder: "https://voice.eriks.co.il" },
      { name: "activepieces_signing_secret", env: "ACTIVEPIECES_SIGNING_SECRET", label: "Signing secret", secret: true, optional: true, hint: "סוד משותף לחתימת הקריאות בין המערכות" },
    ],
  },
  {
    key: "erikscrm",
    name: "ERIKSCRM",
    purpose: "ה־CRM של הסוכנות. מפתח לכל עסק נשמר בדף הלקוח",
    fields: [
      {
        name: "erikscrm_base_url",
        env: "ERIKSCRM_BASE_URL",
        label: "כתובת ה־API",
        secret: false,
        placeholder: "https://…/functions/v1/eriksvoice-api",
        hint: "הכתובת הציבורית של הפונקציה eriksvoice-api, בלי / בסוף",
      },
    ],
  },
];

export const ALL_FIELDS = PROVIDERS.flatMap((p) => p.fields);

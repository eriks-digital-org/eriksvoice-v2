/**
 * What an automation is made of. Shared by the builder (browser) and the engine (server).
 * A spec reads as a sentence: "כאשר <trigger> [בשעות…] אז אחרי <delay>: <actions>".
 */

export type TriggerType =
  | "call_ended"
  | "lead_new"
  | "lead_talked"
  | "lead_no_answer"
  | "webhook_in"
  | "crm_status"
  | "daily"
  | "weekly";

export type ActionType =
  | "call_now"
  | "sms"
  | "email_contact"
  | "notify_team"
  | "webhook"
  | "lead_tag"
  | "report"
  | "activepieces"
  | "crm_log_call"
  | "crm_status"
  | "crm_note"
  | "crm_task";

export type HoursMode = "always" | "business" | "after" | "custom";

export interface AutomationSpec {
  trigger: {
    type: TriggerType;
    config: {
      /** call_ended */
      direction?: "any" | "inbound" | "outbound";
      outcome?: "any" | "success" | "failure";
      /** webhook_in: only events with this name ("" = any) */
      event?: string;
      /** daily / weekly: "HH:MM" Israel time */
      time?: string;
      /** weekly: 0 = Sunday */
      day?: number;
      /** lead_*: only leads in this folder ("" = any) */
      tag?: string;
      /** crm_status: only this new CRM status ("" = any change) */
      status?: string;
    };
  };
  hours: { mode: HoursMode; start?: string; end?: string; days?: number[] };
  delay_minutes: number;
  /** The agent that calls / sends from its number (call_now, sms). */
  agent_id?: string | null;
  actions: { type: ActionType; config: Record<string, string> }[];
  /** Added to the client's agents' instructions while the automation is on. */
  instruction?: string;
}

export interface FieldDef {
  key: string;
  label: string;
  kind: "text" | "textarea" | "url" | "email";
  placeholder?: string;
  hint?: string;
  optional?: boolean;
}

export const TRIGGERS: { type: TriggerType; label: string; phrase: string; hint: string }[] = [
  { type: "call_ended", label: "שיחה הסתיימה", phrase: "שיחה מסתיימת", hint: "כל שיחה של הסוכנים, אפשר לסנן לפי כיוון ותוצאה" },
  { type: "lead_new", label: "ליד חדש", phrase: "נכנס ליד חדש", hint: "ידני, מקובץ, מהאתר או מ־Webhook" },
  { type: "lead_talked", label: "ליד שוחח עם הסוכן", phrase: "ליד מרשימת החיוג שוחח עם הסוכן", hint: "אחרי שיחה מהתותח" },
  { type: "lead_no_answer", label: "ליד לא ענה בכל הניסיונות", phrase: "ליד לא עונה בכל הניסיונות", hint: "אחרי הניסיון האחרון" },
  { type: "webhook_in", label: "נתונים נכנסו ב־Webhook", phrase: "מגיעים נתונים לכתובת ה־Webhook", hint: "טופס באתר, Activepieces, מערכת אחרת" },
  { type: "crm_status", label: "סטטוס השתנה ב־CRM", phrase: "ליד משנה סטטוס ב־CRM", hint: "כשמעבירים ליד לשלב אחר ב־ERIKSCRM" },
  { type: "daily", label: "כל יום בשעה קבועה", phrase: "כל יום", hint: "למשל סיכום יומי" },
  { type: "weekly", label: "פעם בשבוע", phrase: "פעם בשבוע", hint: "למשל דוח שבועי" },
];

export const ACTIONS: { type: ActionType; label: string; phrase: string; fields: FieldDef[]; needsAgent?: boolean; needsContact?: boolean }[] = [
  { type: "call_now", label: "הסוכן מתקשר", phrase: "הסוכן מתקשר ללקוח", fields: [], needsAgent: true, needsContact: true },
  {
    type: "sms",
    label: "שליחת SMS",
    phrase: "נשלח SMS ללקוח",
    needsAgent: true,
    needsContact: true,
    fields: [{ key: "text", label: "תוכן ההודעה", kind: "textarea", placeholder: "היי {{name}}, ניסינו להשיג אותך…" }],
  },
  {
    type: "email_contact",
    label: "מייל ללקוח",
    phrase: "נשלח מייל ללקוח",
    needsContact: true,
    fields: [
      { key: "subject", label: "נושא", kind: "text" },
      { key: "text", label: "תוכן", kind: "textarea" },
    ],
  },
  {
    type: "notify_team",
    label: "התראה לצוות",
    phrase: "הצוות מקבל התראה ומייל",
    fields: [{ key: "text", label: "מה לכתוב", kind: "textarea", placeholder: "{{name}} ({{phone}}): {{summary}}", optional: true }],
  },
  {
    type: "report",
    label: "דוח במייל",
    phrase: "נשלח דוח במייל לצוות",
    fields: [],
  },
  {
    type: "lead_tag",
    label: "העברה לתיקייה",
    phrase: "הליד עובר לתיקייה",
    needsContact: true,
    fields: [
      { key: "tag", label: "תיקייה", kind: "text" },
      { key: "queue", label: "להכניס לתור החיוג? (כן/לא)", kind: "text", optional: true, placeholder: "לא" },
    ],
  },
  {
    type: "webhook",
    label: "שליחה ל־Webhook",
    phrase: "הנתונים נשלחים לכתובת שלכם",
    fields: [{ key: "url", label: "כתובת", kind: "url", placeholder: "https://…" }],
  },
  {
    type: "activepieces",
    label: "פעולה בחשבון שלכם",
    phrase: "פעולה ב־Gmail / יומן / Drive דרך החיבורים",
    fields: [
      { key: "action", label: "פעולה", kind: "text", placeholder: "gmail_send / calendar_create / sheets_append" },
      { key: "params", label: "פרטים (שורה לכל ערך: שם=ערך)", kind: "textarea", optional: true, placeholder: "to={{email}}\nsubject=…" },
    ],
  },
  {
    type: "crm_log_call",
    label: "רישום השיחה ב־CRM",
    phrase: "השיחה נרשמת בכרטיס הליד ב־CRM",
    needsContact: true,
    fields: [{ key: "tag", label: "תגית להוספה בכרטיס", kind: "text", optional: true, placeholder: "שיחת סוכן" }],
  },
  {
    type: "crm_status",
    label: "עדכון סטטוס ב־CRM",
    phrase: "הליד מתעדכן ב־CRM",
    needsContact: true,
    fields: [
      { key: "status", label: "סטטוס חדש", kind: "text", optional: true, hint: "בדיוק כמו ב־CRM, למשל: בתהליך" },
      { key: "tag", label: "תגית להוספה", kind: "text", optional: true },
    ],
  },
  {
    type: "crm_note",
    label: "הערה ב־CRM",
    phrase: "נוספת הערה בכרטיס הליד ב־CRM",
    needsContact: true,
    fields: [{ key: "text", label: "ההערה", kind: "textarea", placeholder: "{{summary}}" }],
  },
  {
    type: "crm_task",
    label: "משימה / פגישה ב־CRM",
    phrase: "נפתחת משימה לנציג ב־CRM",
    needsContact: true,
    fields: [
      { key: "title", label: "כותרת", kind: "text", placeholder: "לחזור אל {{name}}" },
      { key: "hours", label: "בעוד כמה שעות", kind: "text", optional: true, placeholder: "24" },
      { key: "kind", label: "סוג (משימה / פגישה)", kind: "text", optional: true, placeholder: "משימה" },
      { key: "note", label: "הערה", kind: "textarea", optional: true, placeholder: "{{summary}}" },
    ],
  },
];

/** Template gallery categories. */
export const CATEGORIES = [
  { key: "leads", label: "לידים" },
  { key: "calls", label: "שיחות" },
  { key: "followup", label: "מעקב" },
  { key: "reports", label: "דוחות" },
  { key: "integrations", label: "חיבורים" },
] as const;

export const HOURS: { mode: HoursMode; label: string }[] = [
  { mode: "always", label: "כל הזמן" },
  { mode: "business", label: "רק בשעות העבודה (א׳–ה׳ 08:00–19:00)" },
  { mode: "after", label: "רק מחוץ לשעות העבודה" },
  { mode: "custom", label: "שעות שאבחר" },
];

export const VARIABLES = ["name", "phone", "email", "summary", "agent", "business", "direction", "duration", "date", "crm_status"] as const;

export const triggerOf = (t: TriggerType) => TRIGGERS.find((x) => x.type === t);
export const actionOf = (t: ActionType) => ACTIONS.find((x) => x.type === t);

export const EMPTY_SPEC: AutomationSpec = {
  trigger: { type: "lead_new", config: {} },
  hours: { mode: "always" },
  delay_minutes: 0,
  agent_id: null,
  actions: [],
  instruction: "",
};

/** Reads the spec as one Hebrew sentence, for lists and the builder summary. */
export function describe(spec: AutomationSpec): string {
  const t = triggerOf(spec.trigger.type);
  const parts = [`כאשר ${t?.phrase ?? "…"}`];
  if (spec.trigger.type === "daily" && spec.trigger.config.time) parts[0] += ` ב־${spec.trigger.config.time}`;
  if (spec.trigger.type === "weekly")
    parts[0] += ` ביום ${"אבגדהוש"[spec.trigger.config.day ?? 0]}׳${spec.trigger.config.time ? ` ב־${spec.trigger.config.time}` : ""}`;
  if (spec.hours.mode === "business") parts.push("בשעות העבודה");
  if (spec.hours.mode === "after") parts.push("מחוץ לשעות העבודה");
  if (spec.hours.mode === "custom") parts.push(`בין ${spec.hours.start ?? "?"} ל־${spec.hours.end ?? "?"}`);
  const delay = spec.delay_minutes > 0 ? `אחרי ${spec.delay_minutes >= 60 && spec.delay_minutes % 60 === 0 ? `${spec.delay_minutes / 60} שעות` : `${spec.delay_minutes} דקות`}` : "מיד";
  const acts = spec.actions.map((a) => actionOf(a.type)?.phrase ?? a.type).join(", ");
  return `${parts.join(", ")}: ${delay}, ${acts || "…"}.`;
}

/** Fills {{var}} placeholders. Unknown variables become empty. */
export function render(text: string, vars: Record<string, string | number | undefined | null>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => String(vars[k] ?? ""));
}

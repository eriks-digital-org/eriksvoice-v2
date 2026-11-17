/**
 * Tools the agents can use DURING a call. Shared by the admin screen (labels) and the sync
 * (definitions sent to the voice provider). Webhook tools call /api/public/voice/tools/<name>;
 * the provider fills the agent, the caller and the call from its system variables, so a tool
 * can only act for the business that owns the agent.
 */

export type ParamType = "string" | "integer" | "boolean";
export interface ToolParam {
  type: ParamType;
  description: string;
  required?: boolean;
}

export interface CallToolDef {
  name: string;
  /** Admin screen */
  label: string;
  hint: string;
  /** "webhook": our server; "system": the provider's own tool */
  kind: "webhook" | "system";
  /** What the model reads to decide when to use it (Hebrew, short, no business details). */
  description: string;
  params: Record<string, ToolParam>;
  /** Spoken while waiting for the answer (the provider plays filler otherwise). */
  timeoutSecs?: number;
}

export const CALL_TOOLS: CallToolDef[] = [
  {
    name: "check_availability",
    label: "בדיקת זמינות לפגישה",
    hint: "בודק ביומן גוגל של העסק (דרך ה־flow ב־Activepieces) ומציע שעות או ימים פנויים",
    kind: "webhook",
    description: "בודק אילו מועדים פנויים לפגישה. משתמשים בו לפני שמציעים מועד. אפשר לבקש תאריך מסוים.",
    params: {
      date: { type: "string", description: "תאריך מבוקש בפורמט YYYY-MM-DD. ריק = הימים הקרובים" },
    },
  },
  {
    name: "book_meeting",
    label: "קביעת פגישה",
    hint: "קובע את הפגישה ביומן גוגל של העסק ומפעיל אוטומציות של \"פגישה נקבעה\"",
    kind: "webhook",
    description: "קובע פגישה במועד פנוי אחרי שהלקוח אישר את המועד. מחזיר אישור או הודעה שהמועד תפוס.",
    params: {
      start: { type: "string", description: "מועד הפגישה בשעון ישראל, בפורמט YYYY-MM-DD HH:MM", required: true },
      name: { type: "string", description: "השם המלא של הלקוח", required: true },
      email: { type: "string", description: "כתובת מייל אם הלקוח מסר" },
      note: { type: "string", description: "נושא הפגישה או פרטים חשובים, במשפט קצר" },
    },
  },
  {
    name: "my_meetings",
    label: "הפגישות של המתקשר",
    hint: "הסוכן יודע אם למתקשר כבר יש פגישה",
    kind: "webhook",
    description: "מחזיר את הפגישות הקרובות של המתקשר, למשל כשהוא שואל מתי הפגישה שלו.",
    params: {},
  },
  {
    name: "cancel_meeting",
    label: "ביטול פגישה",
    hint: "מוחק מיומן גוגל של העסק את הפגישה הקרובה של המתקשר",
    kind: "webhook",
    description: "מבטל את הפגישה הקרובה של המתקשר, אחרי שהלקוח ביקש וגם אישר את הביטול. כדי לשנות מועד: מבטלים וקובעים מחדש.",
    params: {},
  },
  {
    name: "send_sms",
    label: "שליחת SMS ללקוח",
    hint: "מהמספר של הסוכן. עד 2 הודעות בשיחה",
    kind: "webhook",
    description: "שולח הודעת SMS קצרה למתקשר, למשל כתובת, קישור או סיכום מה שסוכם. רק כשהלקוח ביקש או הסכים.",
    params: { text: { type: "string", description: "תוכן ההודעה, עד 300 תווים", required: true } },
  },
  {
    name: "save_lead",
    label: "שמירת פרטי ליד",
    hint: "שומר ברשימת הלידים של העסק וב־CRM",
    kind: "webhook",
    description: "שומר את פרטי הלקוח כליד של העסק (שם, מייל, מה מעניין אותו). משתמשים בו ברגע שיש פרטים.",
    params: {
      name: { type: "string", description: "השם המלא" },
      email: { type: "string", description: "כתובת מייל" },
      notes: { type: "string", description: "במה הלקוח מתעניין ופרטים חשובים, במשפט או שניים" },
    },
  },
  {
    name: "crm_note",
    label: "הערה בכרטיס ב־CRM",
    hint: "דורש חיבור ל־ERIKSCRM",
    kind: "webhook",
    description: "מוסיף הערה לכרטיס הלקוח ב־CRM של העסק, כשעולה פרט שחשוב לצוות לדעת.",
    params: { text: { type: "string", description: "ההערה", required: true } },
  },
  {
    name: "schedule_callback",
    label: "קביעת חזרה ללקוח",
    hint: "הסוכן יתקשר בעצמו במועד שסוכם",
    kind: "webhook",
    description: "קובע שהסוכן יחזור ללקוח במועד שביקש. מועד מדויק או בעוד כמה דקות.",
    params: {
      at: { type: "string", description: "מתי לחזור בשעון ישראל, בפורמט YYYY-MM-DD HH:MM. ריק אם נאמר משך" },
      in_minutes: { type: "integer", description: "בעוד כמה דקות לחזור, אם הלקוח אמר משך זמן" },
      reason: { type: "string", description: "מה הלקוח ביקש, במשפט קצר" },
    },
  },
  {
    name: "do_not_call",
    label: "הוספה לרשימת \"לא להתקשר\"",
    hint: "כשמתקשר מבקש שלא יתקשרו אליו יותר",
    kind: "webhook",
    description: "מוסיף את המתקשר לרשימת לא להתקשר של העסק, כשהוא מבקש במפורש שלא יתקשרו אליו יותר.",
    params: {},
  },
  {
    name: "notify_team",
    label: "הודעה דחופה לצוות",
    hint: "התראה ומייל לצוות העסק",
    kind: "webhook",
    description: "שולח הודעה לצוות של העסק, למשל כשהלקוח מבקש שאדם יחזור אליו או כשיש עניין דחוף.",
    params: {
      message: { type: "string", description: "מה הצוות צריך לדעת, כולל מה הלקוח מבקש", required: true },
      urgent: { type: "boolean", description: "true אם זה דחוף" },
    },
  },
  {
    name: "email_caller",
    label: "מייל ללקוח",
    hint: "עד 2 מיילים בשיחה",
    kind: "webhook",
    description: "שולח מייל ללקוח עם מידע שביקש. רק אחרי שהלקוח מסר כתובת מייל ואישר אותה.",
    params: {
      email: { type: "string", description: "כתובת המייל של הלקוח", required: true },
      subject: { type: "string", description: "נושא המייל", required: true },
      text: { type: "string", description: "תוכן המייל", required: true },
    },
  },
  {
    name: "business_action",
    label: "פעולה מותאמת (Activepieces / אוטומציה)",
    hint: "מפעיל אוטומציות \"הסוכן ביקש פעולה\" ואת ה־flow של העסק ב־Activepieces",
    kind: "webhook",
    timeoutSecs: 15,
    description: "מבצע פעולה מיוחדת של העסק לפי שם הפעולה, כשההוראות של העסק אומרות להשתמש בה.",
    params: {
      action: { type: "string", description: "שם הפעולה כפי שמופיע בהוראות", required: true },
      details: { type: "string", description: "הפרטים הנדרשים לפעולה" },
    },
  },
  { name: "end_call", label: "סיום שיחה", hint: "הסוכן מנתק כשהשיחה הסתיימה", kind: "system", description: "", params: {} },
  { name: "voicemail", label: "זיהוי תא קולי", hint: "בשיחה יוצאת שהגיעה לתא קולי, הסוכן מנתק", kind: "system", description: "", params: {} },
  {
    name: "transfer_human",
    label: "העברה לנציג אנושי",
    hint: "דורש מספר העברה בהגדרות הלקוח",
    kind: "system",
    description: "",
    params: {},
  },
];

export const WEBHOOK_TOOLS = CALL_TOOLS.filter((t) => t.kind === "webhook");
export const toolByName = (name: string) => CALL_TOOLS.find((t) => t.name === name);

export interface ConnectionKind {
  kind: string;
  label: string;
  description: string;
  /** Not available in phase 1 (waiting on Meta approval or an API document). */
  later?: string;
  adminOnly?: boolean;
}

export const CONNECTIONS: ConnectionKind[] = [
  { kind: "google_calendar", label: "Google Calendar", description: "בדיקת זמינות, קביעה, שינוי וביטול פגישות" },
  { kind: "gmail", label: "Gmail", description: "שליחת מיילים מהחשבון של העסק" },
  { kind: "google_drive", label: "Google Drive", description: "חיפוש קבצים" },
  { kind: "webhook", label: "API / Webhook", description: "שליחת נתונים לכתובת שלכם, וקבלת לידים בכתובת שלנו" },
  { kind: "sms", label: "SMS", description: "הודעות מהמספר של הסוכן" },
  { kind: "erikscrm", label: "ERIKSCRM", description: "זיהוי מתקשר, יצירת ליד ורישום שיחה", later: "בקרוב" },
  { kind: "whatsapp", label: "WhatsApp", description: "שליחת הודעות והודעות נכנסות", later: "בקרוב" },
  { kind: "facebook_leads", label: "לידים מפייסבוק", description: "ליד חדש מפייסבוק כטריגר", later: "בקרוב" },
];

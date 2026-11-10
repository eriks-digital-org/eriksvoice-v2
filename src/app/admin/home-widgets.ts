/** The widgets an admin can show on the admin home page (order = default order). */
export const WIDGETS = [
  { key: "stats", label: "מספרים של היום" },
  { key: "live", label: "שיחות פתוחות עכשיו" },
  { key: "attention", label: "דורש טיפול (בקשות חיבור, סוכנים בתקלה, מכסות)" },
  { key: "contacts", label: "פניות מהאתר" },
  { key: "calls", label: "שיחות אחרונות" },
  { key: "clients", label: "לקוחות אחרונים" },
] as const;
export type WidgetKey = (typeof WIDGETS)[number]["key"];
export const DEFAULT_WIDGETS: WidgetKey[] = WIDGETS.map((w) => w.key);

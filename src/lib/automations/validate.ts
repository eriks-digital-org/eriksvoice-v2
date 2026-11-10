import { ACTIONS, TRIGGERS, type AutomationSpec } from "./catalog";

/** Validates a spec coming from a form. Returns the cleaned spec or a Hebrew error. */
export function parseSpec(raw: string): { spec: AutomationSpec } | { error: string } {
  let s: AutomationSpec;
  try {
    s = JSON.parse(raw) as AutomationSpec;
  } catch {
    return { error: "האוטומציה לא תקינה" };
  }
  if (!TRIGGERS.some((t) => t.type === s.trigger?.type)) return { error: "בוחרים טריגר" };
  if (!Array.isArray(s.actions) || s.actions.length === 0) return { error: "מוסיפים לפחות פעולה אחת" };
  if (s.actions.length > 8) return { error: "עד 8 פעולות" };
  for (const a of s.actions) {
    const def = ACTIONS.find((d) => d.type === a.type);
    if (!def) return { error: "פעולה לא מוכרת" };
    for (const f of def.fields) {
      const v = (a.config?.[f.key] ?? "").trim();
      if (!v && !f.optional) return { error: `חסר "${f.label}" ב"${def.label}"` };
      if (f.kind === "url" && v && !/^https:\/\/\S+$/.test(v)) return { error: "כתובת צריכה להתחיל ב־https://" };
      if (v.length > 2000) return { error: "טקסט ארוך מדי" };
    }
  }
  const delay = Math.min(10080, Math.max(0, Math.round(Number(s.delay_minutes) || 0)));
  return {
    spec: {
      trigger: { type: s.trigger.type, config: s.trigger.config ?? {} },
      hours: s.hours?.mode ? s.hours : { mode: "always" },
      delay_minutes: delay,
      agent_id: s.agent_id || null,
      actions: s.actions.map((a) => ({ type: a.type, config: Object.fromEntries(Object.entries(a.config ?? {}).map(([k, v]) => [k, String(v).slice(0, 2000)])) })),
      instruction: (s.instruction ?? "").slice(0, 1000),
    },
  };
}

/** Whether the spec needs an agent and none is chosen. */
export const missingAgent = (s: AutomationSpec) => s.actions.some((a) => ACTIONS.find((d) => d.type === a.type)?.needsAgent) && !s.agent_id;

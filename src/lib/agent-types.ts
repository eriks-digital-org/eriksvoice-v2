export type AgentTypeKey = "leads" | "sales" | "service" | "support" | "custom";

export const AGENT_TYPE_KEYS: AgentTypeKey[] = ["leads", "sales", "service", "support", "custom"];

export const agentTypeLabels: Record<AgentTypeKey, string> = {
  leads: "סוכן לידים",
  sales: "סוכן מכירות",
  service: "סוכן שירות לקוחות",
  support: "סוכן תמיכה",
  custom: "סוכן מותאם אישית",
};

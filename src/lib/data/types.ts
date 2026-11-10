import type { AgentTypeKey } from "@/lib/agent-types";
import type { AgentStatus, ClientStatus, ConnStatus } from "@/components/ds/StatusBadge";

export interface ClientRow {
  id: string;
  slug: string;
  name: string;
  status: ClientStatus;
  industry: string;
  address: string;
  contact_phone: string;
  notify_email: string;
  description: string;
  business_hours: Record<string, unknown>;
  monthly_minutes: number;
  quota_reset_day: number;
  created_at: string;
}

export interface AgentRow {
  id: string;
  client_id: string;
  type_key: AgentTypeKey;
  name: string;
  status: AgentStatus;
  voice_id: string | null;
  opening_line: string;
  llm_model_override?: string | null;
  realtime_model_override?: string | null;
  custom_prompt?: string;
  sync_status?: "none" | "pending" | "ok" | "failed";
  sync_error?: string | null;
}

export interface AgentTypeRow {
  key: AgentTypeKey;
  name: string;
  purpose: string;
  prompt: string;
  llm_model: string;
  realtime_model?: string;
  default_voice_id: string;
  allowed_voice_ids: string[];
  voice_settings: Record<string, unknown>;
  conversation_settings: Record<string, unknown>;
  sort: number;
  updated_at: string;
}

export interface PhoneRow {
  id: string;
  client_id: string;
  e164: string;
  agent_id: string | null;
  is_primary: boolean;
  label: string;
  route_error?: string | null;
  provider_phone_id?: string | null;
}

export interface ConnectionRow {
  id: string;
  client_id: string;
  kind: string;
  status: ConnStatus;
  requested_at: string | null;
  tested_at: string | null;
}

export interface KnowledgeRow {
  id: string;
  client_id: string;
  kind: "text" | "file";
  title: string;
  body: string;
  all_agents: boolean;
  updated_at: string;
}

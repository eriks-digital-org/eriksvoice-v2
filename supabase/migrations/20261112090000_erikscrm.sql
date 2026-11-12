-- ERIKSCRM (AgencyES) connection.
-- The client's API key and the webhook signing secret live in Supabase Vault
-- (ev_crm_key_<client id hex>, ev_crm_hook_<client id hex>); options live in connections.config.

alter table public.connections add column if not exists config jsonb not null default '{}'::jsonb;
-- Client users keep their column grants on connections (config is admin-only).

-- Leads that came from the CRM, linked to the CRM card.
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source in ('manual', 'csv', 'api', 'webform', 'crm'));
alter table public.leads add column if not exists crm_id text;
create index if not exists leads_crm on public.leads (client_id, crm_id) where crm_id is not null;

-- CRM deliveries already handled (X-Event-ID), so a retried delivery is handled once.
create table if not exists public.crm_deliveries (
  client_id uuid not null references public.clients (id) on delete cascade,
  delivery_id text not null,
  event text not null,
  received_at timestamptz not null default now(),
  primary key (client_id, delivery_id)
);
alter table public.crm_deliveries enable row level security;

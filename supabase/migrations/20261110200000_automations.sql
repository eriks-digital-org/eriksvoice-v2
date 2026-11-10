-- Automations: trigger -> (hours) -> delay -> actions. The engine runs in our server
-- (every minute, with the dialer). Actions that need a client's own account (Gmail,
-- Calendar, Drive...) are handed to that client's flow in Activepieces.

-- Templates the admin builds for everyone (edit / hide / delete).
create table public.automation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null default '',
  saves text not null default '',
  category text not null default 'leads',
  spec jsonb not null,
  hidden boolean not null default false,
  sort integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger automation_templates_touch before update on public.automation_templates
  for each row execute function public.touch_updated_at();

-- A client's automations (from a template or built from scratch).
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  template_id uuid references public.automation_templates (id) on delete set null,
  -- the template version this copy was taken from (updates are opt-in)
  template_version integer,
  name text not null,
  enabled boolean not null default true,
  -- { trigger: {type, config}, hours: {mode, start, end, days}, delay_minutes,
  --   actions: [{type, config}], instruction }
  spec jsonb not null,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automations_client on public.automations (client_id) where enabled;
create trigger automations_touch before update on public.automations
  for each row execute function public.touch_updated_at();

-- One row per triggered run: the queue and the log.
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  event jsonb not null default '{}'::jsonb,
  dedup_key text not null default '',
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'skipped')),
  attempts integer not null default 0,
  run_at timestamptz not null default now(),
  -- [{ action, ok, message, at }]
  log jsonb not null default '[]'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index automation_runs_due on public.automation_runs (run_at) where status = 'queued';
create index automation_runs_dedup on public.automation_runs (automation_id, dedup_key, created_at desc);
create index automation_runs_client on public.automation_runs (client_id, created_at desc);

-- Each client gets a secret address for incoming webhooks (site forms, Activepieces, CRM).
alter table public.clients add column inbound_token text not null default replace(gen_random_uuid()::text, '-', '');
create unique index clients_inbound_token on public.clients (inbound_token);

-- Leads may carry an email (for email actions).
alter table public.leads add column email text not null default '';
grant select (email) on public.leads to authenticated;
grant insert (email) on public.leads to authenticated;
grant update (email) on public.leads to authenticated;

alter table public.automation_templates enable row level security;
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

-- Client users: see visible templates, manage their automations, read their run log.
grant select on public.automation_templates to authenticated;
create policy templates_visible on public.automation_templates for select to authenticated using (not hidden);

grant select, insert, delete on public.automations to authenticated;
grant update (name, enabled, spec, template_version) on public.automations to authenticated;
create policy automations_member on public.automations for all to authenticated
  using (public.is_member(client_id)) with check (public.is_member(client_id));

grant select on public.automation_runs to authenticated;
create policy runs_member on public.automation_runs for select to authenticated using (public.is_member(client_id));

-- The client's flow in Activepieces (its webhook address), set by the admin. Not visible to
-- client users (their column grants on connections don't include it).
alter table public.connections add column flow_url text;
alter table public.connections drop constraint connections_kind_check;
alter table public.connections add constraint connections_kind_check check (kind in (
  'google_calendar', 'gmail', 'google_drive', 'webhook', 'sms', 'mcp', 'erikscrm', 'whatsapp', 'facebook_leads', 'activepieces'
));

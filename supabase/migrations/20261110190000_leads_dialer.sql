-- Leads and the call cannon (outbound dialer). Leads already gave consent to be called.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null default '',
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  notes text not null default '',
  -- folders: a lead can be in several
  tags text[] not null default '{}',
  source text not null default 'manual' check (source in ('manual', 'csv', 'api', 'webform')),
  -- new: not queued; queued: waiting for the cannon; calling: a call is out;
  -- done: talked; failed: no answer after all attempts; dnc: never call
  status text not null default 'new' check (status in ('new', 'queued', 'calling', 'done', 'failed', 'dnc')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  last_called_at timestamptz,
  last_conversation_id text,
  last_result text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, phone)
);
create index leads_queue on public.leads (client_id, status, next_attempt_at);
create index leads_conversation on public.leads (last_conversation_id) where last_conversation_id is not null;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- One dialer per client.
create table public.dialer_settings (
  client_id uuid primary key references public.clients (id) on delete cascade,
  enabled boolean not null default false,
  agent_id uuid,
  -- only leads with this folder; '' = all
  tag text not null default '',
  -- Israel time, minutes from midnight; days 0 = Sunday
  start_minute integer not null default 540 check (start_minute between 0 and 1439),
  end_minute integer not null default 1140 check (end_minute between 1 and 1440),
  days smallint[] not null default '{0,1,2,3,4}',
  concurrency integer not null default 3 check (concurrency between 1 and 3),
  max_attempts integer not null default 3 check (max_attempts between 1 and 3),
  retry_minutes integer not null default 120 check (retry_minutes between 10 and 2880),
  updated_at timestamptz not null default now(),
  foreign key (agent_id, client_id) references public.agents (id, client_id) on delete set null (agent_id)
);
create trigger dialer_settings_touch before update on public.dialer_settings
  for each row execute function public.touch_updated_at();

alter table public.leads enable row level security;
alter table public.dialer_settings enable row level security;

-- Client users manage their own leads (not the dialer's bookkeeping columns).
grant select (id, client_id, name, phone, notes, tags, source, status, attempts, next_attempt_at, last_called_at, last_result, created_at, updated_at)
  on public.leads to authenticated;
grant insert (client_id, name, phone, notes, tags, source, status) on public.leads to authenticated;
grant update (name, phone, notes, tags, status) on public.leads to authenticated;
grant delete on public.leads to authenticated;
create policy leads_member on public.leads for all to authenticated
  using (public.is_member(client_id)) with check (public.is_member(client_id) and status in ('new', 'queued', 'dnc', 'done', 'failed'));

grant select, insert on public.dialer_settings to authenticated;
grant update (enabled, agent_id, tag, start_minute, end_minute, days, max_attempts, retry_minutes) on public.dialer_settings to authenticated;
create policy dialer_member on public.dialer_settings for all to authenticated
  using (public.is_member(client_id)) with check (public.is_member(client_id));

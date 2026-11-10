-- Calls: one row per conversation at the voice provider, written by the post-call
-- webhook (or the backfill). The recording stays at the provider and is streamed
-- through our server after an access check.
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  agent_id uuid,
  provider_conversation_id text not null unique,
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound', 'web')),
  external_number text not null default '',
  agent_number text not null default '',
  status text not null default 'done',
  -- success | failure | unknown (the provider's own evaluation)
  outcome text not null default 'unknown',
  started_at timestamptz not null default now(),
  duration_secs integer not null default 0 check (duration_secs >= 0),
  summary text not null default '',
  -- [{ role: 'agent' | 'user', text, at }]
  transcript jsonb not null default '[]'::jsonb,
  -- data collected during the call (provider data collection results)
  collected jsonb not null default '{}'::jsonb,
  has_audio boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (agent_id, client_id) references public.agents (id, client_id) on delete set null (agent_id)
);
create index calls_client_started on public.calls (client_id, started_at desc);
create index calls_started on public.calls (started_at desc);

alter table public.calls enable row level security;
grant select (id, client_id, agent_id, direction, external_number, agent_number, status, outcome, started_at,
  duration_secs, summary, transcript, collected, has_audio, created_at)
  on public.calls to authenticated;
create policy calls_member on public.calls for select to authenticated using (public.is_member(client_id));

-- Minutes used per client per calendar month (Israel time), for quotas and the usage screens.
create or replace view public.client_month_usage with (security_invoker = true) as
select client_id,
       date_trunc('month', started_at at time zone 'Asia/Jerusalem') as month,
       count(*)::int as calls,
       ceil(sum(duration_secs) / 60.0)::int as minutes
from public.calls
group by 1, 2;
grant select on public.client_month_usage to authenticated;

-- So the 80% alert is sent once per client per month.
alter table public.clients add column quota_alerted_month date;

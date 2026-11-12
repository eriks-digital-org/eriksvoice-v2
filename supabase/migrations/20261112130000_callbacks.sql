-- Call-backs: a caller asked the agent to call them back later ("תחזור אליי עוד שעה").
-- The time comes from the call's analysis; the same agent calls at that time
-- (moved into the calling hours), with up to 3 attempts.
create table public.callbacks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  agent_id uuid not null,
  phone text not null,
  name text not null default '',
  -- what the caller said about it, in their words
  request text not null default '',
  -- the call in which they asked (one call-back per call)
  source_conversation_id text not null unique,
  due_at timestamptz not null,
  -- scheduled: waiting; calling: a call is out; done: talked; failed: no answer after all
  -- attempts; cancelled: they called in, or talked to us, before it was due
  status text not null default 'scheduled' check (status in ('scheduled', 'calling', 'done', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  last_called_at timestamptz,
  last_conversation_id text,
  last_result text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (agent_id, client_id) references public.agents (id, client_id) on delete cascade
);
create index callbacks_due on public.callbacks (status, due_at);
create index callbacks_phone on public.callbacks (client_id, phone, status);
create index callbacks_conversation on public.callbacks (last_conversation_id) where last_conversation_id is not null;
create trigger callbacks_touch before update on public.callbacks
  for each row execute function public.touch_updated_at();

alter table public.callbacks enable row level security;
grant select on public.callbacks to authenticated;
create policy callbacks_member on public.callbacks for select to authenticated
  using (public.is_member(client_id));

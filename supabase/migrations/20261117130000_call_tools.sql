-- Tools the agents use DURING a call (ElevenLabs webhook tools that call our server):
-- meetings, SMS, leads, CRM notes, call-backs, do-not-call, team alerts, email, business actions,
-- plus the provider's own end-call / voicemail / transfer-to-a-person tools.

-- Per business: which tools its agents get, meeting length, and a person to transfer to.
alter table public.clients
  add column call_tools text[] not null default '{check_availability,book_meeting,my_meetings,cancel_meeting,send_sms,save_lead,crm_note,schedule_callback,do_not_call,notify_team,email_caller,business_action,end_call,voicemail}',
  add column meeting_minutes integer not null default 30 check (meeting_minutes between 5 and 480),
  add column transfer_phone text not null default '' check (transfer_phone = '' or transfer_phone ~ '^\+[1-9][0-9]{6,14}$');

-- The shared tool definitions at the provider: { name: { id, hash } }.
alter table public.system_settings add column call_tools jsonb not null default '{}'::jsonb;

-- Meetings booked by the agents (or by the business).
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  agent_id uuid,
  lead_id uuid references public.leads (id) on delete set null,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  note text not null default '' check (length(note) <= 1000),
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  source text not null default 'call' check (source in ('call', 'manual')),
  conversation_id text,
  crm_task_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_client_start on public.appointments (client_id, starts_at) where status = 'booked';
create index appointments_phone on public.appointments (client_id, phone, starts_at);
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

alter table public.appointments enable row level security;
grant select on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;
create policy appointments_member on public.appointments for select to authenticated using (public.is_member(client_id));
create policy appointments_member_cancel on public.appointments for update to authenticated
  using (public.is_member(client_id)) with check (public.is_member(client_id));

-- Books a meeting unless it overlaps another booked one of the same business. Atomic per business.
create or replace function public.book_appointment(
  p_client_id uuid, p_agent_id uuid, p_lead_id uuid, p_name text, p_phone text, p_email text,
  p_starts_at timestamptz, p_minutes integer, p_note text, p_conversation_id text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('appt:' || p_client_id::text, 0));
  if exists (
    select 1 from public.appointments
    where client_id = p_client_id and status = 'booked'
      and starts_at < p_starts_at + make_interval(mins => p_minutes)
      and starts_at + make_interval(mins => duration_minutes) > p_starts_at
  ) then
    return null;
  end if;
  insert into public.appointments (client_id, agent_id, lead_id, name, phone, email, starts_at, duration_minutes, note, conversation_id)
  values (p_client_id, p_agent_id, p_lead_id, p_name, p_phone, p_email, p_starts_at, p_minutes, p_note, p_conversation_id)
  returning id into new_id;
  return new_id;
end
$$;
revoke all on function public.book_appointment(uuid, uuid, uuid, text, text, text, timestamptz, integer, text, text) from public, anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, uuid, text, text, text, timestamptz, integer, text, text) to service_role;

-- Leads saved by an agent during a call.
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source in ('manual', 'csv', 'api', 'webform', 'crm', 'call'));

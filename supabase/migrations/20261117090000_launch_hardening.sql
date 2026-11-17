-- Launch hardening.

-- 1. Clients save automations only through the portal's server actions (which check that the
--    chosen agent is theirs and validate every field). No direct writes with a client's login.
revoke insert, update on public.automations from authenticated;

-- 2. When a run was taken off the queue, so a run still in progress is never put back
--    (and run a second time) by the next tick.
alter table public.automation_runs add column claimed_at timestamptz;
create index automation_runs_running on public.automation_runs (claimed_at) where status = 'running';

-- 3. Queue a run unless the same automation already ran for the same thing in the last 24 hours.
--    Atomic: two identical events at the same moment queue one run.
create or replace function public.enqueue_automation_run(
  p_automation_id uuid, p_client_id uuid, p_event jsonb, p_dedup_key text, p_run_at timestamptz
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_automation_id::text || ':' || p_dedup_key, 0));
  if exists (
    select 1 from public.automation_runs
    where automation_id = p_automation_id and dedup_key = p_dedup_key and created_at >= now() - interval '24 hours'
  ) then
    return false;
  end if;
  insert into public.automation_runs (automation_id, client_id, event, dedup_key, run_at)
  values (p_automation_id, p_client_id, p_event, p_dedup_key, p_run_at);
  return true;
end
$$;
revoke all on function public.enqueue_automation_run(uuid, uuid, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_automation_run(uuid, uuid, jsonb, text, timestamptz) to service_role;

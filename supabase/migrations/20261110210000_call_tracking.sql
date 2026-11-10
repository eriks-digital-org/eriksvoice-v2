-- Outbound calls are recorded the moment they are placed (not only when the post-call
-- webhook arrives), so failed calls and calls still in progress show on the calls screen,
-- and a live call can be hung up from there.
alter table public.calls alter column provider_conversation_id drop not null;
alter table public.calls add column call_sid text;
-- Why the call ended without a conversation (no answer, busy, Twilio error) or "hung up manually".
alter table public.calls add column end_reason text not null default '';
alter table public.calls add column ended_at timestamptz;
create index calls_live on public.calls (started_at desc) where status in ('calling', 'ringing', 'in_progress');
grant select (end_reason, ended_at) on public.calls to authenticated;

-- Usage counts only calls that actually connected.
create or replace view public.client_month_usage with (security_invoker = true) as
select client_id,
       date_trunc('month', started_at at time zone 'Asia/Jerusalem') as month,
       count(*)::int as calls,
       ceil(sum(duration_secs) / 60.0)::int as minutes
from public.calls
where status not in ('failed', 'no_answer')
group by 1, 2;

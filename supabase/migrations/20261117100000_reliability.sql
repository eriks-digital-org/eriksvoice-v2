-- Rate limits for public addresses (landing contact form, client webhooks, CRM webhooks).
create table public.rate_hits (
  key text not null,
  at timestamptz not null default now()
);
create index rate_hits_key_at on public.rate_hits (key, at desc);
alter table public.rate_hits enable row level security; -- service role only

-- True (and counts the hit) when `key` had fewer than `max_hits` hits in the last `window_secs`.
create or replace function public.rate_ok(p_key text, p_max integer, p_window_secs integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('rate:' || p_key, 0));
  select count(*) into n from public.rate_hits where key = p_key and at > now() - make_interval(secs => p_window_secs);
  if n >= p_max then return false; end if;
  insert into public.rate_hits (key) values (p_key);
  -- Keep the table small.
  if random() < 0.01 then delete from public.rate_hits where at < now() - interval '1 day'; end if;
  return true;
end
$$;
revoke all on function public.rate_ok(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_ok(text, integer, integer) to service_role;

-- Every client gets a weekly email summary (Sunday 09:00) unless they already have a report.
insert into public.automations (client_id, name, spec)
select c.id, 'סיכום שבועי במייל',
  '{"trigger":{"type":"weekly","config":{"day":0,"time":"09:00"}},"hours":{"mode":"always"},"delay_minutes":0,"agent_id":null,"actions":[{"type":"report","config":{}}],"instruction":""}'::jsonb
from public.clients c
where not exists (
  select 1 from public.automations a
  where a.client_id = c.id and a.spec->'actions' @> '[{"type":"report"}]'::jsonb
);

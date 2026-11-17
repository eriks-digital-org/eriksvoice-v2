-- Call result: one of a fixed list plus a short note, set by the business (or the admin) on the
-- call screen. Separate from `outcome` (the voice provider's own success evaluation).
alter table public.calls
  add column result text check (result in ('meeting', 'interested', 'not_interested', 'callback', 'irrelevant', 'other')),
  add column result_note text not null default '' check (length(result_note) <= 300);
create index calls_client_result on public.calls (client_id, result) where result is not null;

grant select (result, result_note) on public.calls to authenticated;
grant update (result, result_note) on public.calls to authenticated;
create policy calls_member_result on public.calls for update to authenticated
  using (public.is_member(client_id)) with check (public.is_member(client_id));

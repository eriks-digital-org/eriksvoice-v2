-- Voice provider sync (ElevenLabs): what each agent type sends, and where each
-- knowledge item lives at the provider.

-- Voices a client may pick, with their names (shown in the portal).
-- allowed_voice_ids stays the list the database checks against.
alter table public.agent_types
  add column allowed_voices jsonb not null default '[]'::jsonb,
  -- Speech model. v4 Turbo speaks Hebrew; Flash/Turbo v2.5 do not.
  add column tts_model text not null default 'eleven_v4_turbo',
  add column language text not null default 'he';

-- The provider document that mirrors a knowledge item, and a hash of what was sent,
-- so an unchanged item is not uploaded again.
alter table public.knowledge_items
  add column provider_doc_id text,
  add column provider_doc_hash text;

-- Documents to delete at the provider after their item was changed or removed.
create table public.provider_doc_trash (
  doc_id text primary key,
  created_at timestamptz not null default now()
);
alter table public.provider_doc_trash enable row level security;

create or replace function public.knowledge_trash_doc() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.provider_doc_id is not null and (tg_op = 'DELETE' or new.provider_doc_id is distinct from old.provider_doc_id) then
    insert into public.provider_doc_trash (doc_id) values (old.provider_doc_id) on conflict do nothing;
  end if;
  return coalesce(new, old);
end $$;
create trigger knowledge_items_trash_doc
  after update or delete on public.knowledge_items
  for each row execute function public.knowledge_trash_doc();

-- Client users must not see provider ids.
revoke select on public.knowledge_items from authenticated;
grant select (id, client_id, kind, title, body, file_path, file_name, all_agents, created_by, created_at, updated_at)
  on public.knowledge_items to authenticated;
revoke update on public.knowledge_items from authenticated;
grant update (title, body, all_agents) on public.knowledge_items to authenticated;
revoke insert on public.knowledge_items from authenticated;
grant insert (client_id, kind, title, body, all_agents) on public.knowledge_items to authenticated;

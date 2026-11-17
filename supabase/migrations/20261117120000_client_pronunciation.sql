-- Pronunciation words per business (its name, streets, staff names), on top of the shared list.
-- A business's words are sent as its own dictionary, ahead of the shared one, so they win.
alter table public.pronunciation_rules add column client_id uuid references public.clients (id) on delete cascade;
drop index if exists public.pronunciation_rules_term;
create unique index pronunciation_rules_term on public.pronunciation_rules
  (coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(term));
create index pronunciation_rules_client on public.pronunciation_rules (client_id) where client_id is not null;

alter table public.clients
  add column pronunciation_dict_id text,
  add column pronunciation_dict_version text,
  add column pronunciation_dict_hash text;

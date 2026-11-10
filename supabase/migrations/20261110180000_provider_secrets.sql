-- Provider keys managed from the admin panel, encrypted in Supabase Vault.
-- Only the service role (the server, after requireAdmin) may read or change them.
-- Names are stored in the vault as 'ev_<name>'.

create extension if not exists supabase_vault with schema vault;

create or replace function public.app_secrets_get()
returns table (name text, secret text, updated_at timestamptz)
language sql security definer set search_path = '' as $$
  select substr(s.name, 4), s.decrypted_secret, s.updated_at
  from vault.decrypted_secrets s
  where s.name like 'ev\_%';
$$;

create or replace function public.app_secret_set(p_name text, p_value text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid;
begin
  if p_name !~ '^[a-z0-9_]{2,60}$' then
    raise exception 'bad secret name';
  end if;
  select id into sid from vault.secrets where name = 'ev_' || p_name;
  if coalesce(p_value, '') = '' then
    if sid is not null then
      delete from vault.secrets where id = sid;
    end if;
  elsif sid is null then
    perform vault.create_secret(p_value, 'ev_' || p_name);
  else
    perform vault.update_secret(sid, p_value);
  end if;
end $$;

revoke all on function public.app_secrets_get() from public, anon, authenticated;
revoke all on function public.app_secret_set(text, text) from public, anon, authenticated;
grant execute on function public.app_secrets_get() to service_role;
grant execute on function public.app_secret_set(text, text) to service_role;

-- Who changed which key and when (never the value).
create table public.provider_secret_log (
  id bigint generated always as identity primary key,
  name text not null,
  action text not null check (action in ('set', 'clear')),
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
alter table public.provider_secret_log enable row level security;

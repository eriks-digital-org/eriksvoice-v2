-- EriksVoice 2: core schema (phase 1, part 1).
--
-- Tenant isolation is enforced here, not only in the screens:
--  * Client users (role "authenticated") read and change only rows of the clients
--    they are members of (RLS), and only the columns granted below.
--  * The admin panel runs on the server with the service role, after the server
--    checked profiles.is_admin. Agent prompts, models and provider ids are never
--    granted to client users.
--  * Rows that point at other rows carry client_id and use composite foreign keys,
--    so no row can point at a row of another client.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- helpers
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users that existed before this migration.
insert into public.profiles (id, email)
select id, lower(email) from auth.users
on conflict (id) do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------- clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  -- The portal address: eriksvoice.co.il/<slug>
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$')
    check (slug not in (
      'admin', 'login', 'logout', 'register', 'signup', 'api', 'auth', 'portal', 'app', 'www',
      'landing', 'landing-assets', 'agents', 'bg', 'brand', 'work', 'set-password',
      'forgot-password', 'reset-password', 'settings', 'help', 'support', 'status', 'robots.txt'
    )),
  name text not null check (length(trim(name)) > 0),
  status text not null default 'onboarding' check (status in ('onboarding', 'active', 'paused')),
  -- Business details (set by the admin at onboarding; go into the agents' prompt)
  industry text not null default '',
  address text not null default '',
  business_hours jsonb not null default '{}'::jsonb,
  contact_phone text not null default '',
  notify_email text not null default '',
  description text not null default '',
  -- Quota
  monthly_minutes integer not null default 0 check (monthly_minutes >= 0),
  quota_reset_day smallint not null default 1 check (quota_reset_day between 1 and 28),
  -- Future SaaS plans (minutes, active agents, features). Unused in phase 1.
  plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

create table public.client_members (
  client_id uuid not null references public.clients (id) on delete cascade,
  -- profiles.id is auth.users.id; referencing profiles lets the API join a member's name.
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index client_members_user on public.client_members (user_id);

create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.client_members where client_id = cid and user_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------- agent types (global)
-- The five global agent types. The admin writes each one's prompt; they start EMPTY.
create table public.agent_types (
  key text primary key check (key in ('leads', 'sales', 'service', 'support', 'custom')),
  name text not null,
  purpose text not null default '',
  prompt text not null default '',
  llm_model text not null default '',
  default_voice_id text not null default '',
  -- Voices a client may pick for an agent of this type
  allowed_voice_ids text[] not null default '{}',
  -- ElevenLabs voice settings (speed, stability, ...) and conversation settings (turns, timeouts)
  voice_settings jsonb not null default '{}'::jsonb,
  conversation_settings jsonb not null default '{}'::jsonb,
  sort smallint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create trigger agent_types_touch before update on public.agent_types
  for each row execute function public.touch_updated_at();

insert into public.agent_types (key, name, purpose, sort) values
  ('leads', 'סוכן לידים', 'להחזיר שיחה לליד מהר, לסנן ולאסוף פרטים', 1),
  ('sales', 'סוכן מכירות', 'לקדם למכירה ולקבוע פגישה', 2),
  ('service', 'סוכן שירות לקוחות', 'לענות על שאלות, לרשום פניות ולנתב', 3),
  ('support', 'סוכן תמיכה', 'לפתור תקלות ולהסלים לנציג', 4),
  ('custom', 'סוכן מותאם אישית', 'מה שהעסק צריך', 5);

-- ---------------------------------------------------------------- system settings (singleton)
create table public.system_settings (
  id boolean primary key default true check (id),
  -- Layer 1 of every prompt: system and safety rules (incl. the recording notice). Starts empty.
  safety_rules text not null default '',
  default_business_hours jsonb not null default '{}'::jsonb,
  alert_emails text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger system_settings_touch before update on public.system_settings
  for each row execute function public.touch_updated_at();
insert into public.system_settings (id) values (true);

-- ---------------------------------------------------------------- agents (per client)
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  type_key text not null references public.agent_types (key),
  name text not null check (length(trim(name)) > 0),
  -- draft: saved only here. active: exists at the voice provider for this client.
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  -- What the client may change: name, voice (from the type's allowed list), opening line
  voice_id text,
  opening_line text not null default '',
  -- Admin only
  llm_model_override text,
  custom_prompt text not null default '',
  provider_agent_id text unique,
  sync_status text not null default 'none' check (sync_status in ('none', 'pending', 'ok', 'failed')),
  sync_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, client_id)
);
create index agents_client on public.agents (client_id);
create trigger agents_touch before update on public.agents
  for each row execute function public.touch_updated_at();

-- A client user may pick only a voice the admin allowed for the agent's type.
create or replace function public.agents_check_voice() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  allowed text[];
begin
  if new.voice_id is null or new.voice_id is not distinct from old.voice_id then
    return new;
  end if;
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new; -- service role (admin panel) may set any voice
  end if;
  select allowed_voice_ids into allowed from public.agent_types where key = new.type_key;
  if not (new.voice_id = any (coalesce(allowed, '{}'))) then
    raise exception 'voice not allowed for this agent' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger agents_voice before update on public.agents
  for each row execute function public.agents_check_voice();

-- ---------------------------------------------------------------- phone numbers
-- One number belongs to one business. Bought manually at Twilio, assigned by the admin.
create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  e164 text not null unique check (e164 ~ '^\+[1-9][0-9]{6,14}$'),
  provider text not null default 'twilio',
  provider_sid text,
  -- The agent this number reaches (for the primary number: who answers inbound calls)
  agent_id uuid,
  is_primary boolean not null default false,
  label text not null default '',
  created_at timestamptz not null default now(),
  foreign key (agent_id, client_id) references public.agents (id, client_id) on delete set null (agent_id)
);
create unique index phone_numbers_one_primary on public.phone_numbers (client_id) where is_primary;
create index phone_numbers_client on public.phone_numbers (client_id);

-- ---------------------------------------------------------------- knowledge
create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'file')),
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  file_path text,
  file_name text,
  -- false = only the agents in knowledge_item_agents get it
  all_agents boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, client_id)
);
create index knowledge_items_client on public.knowledge_items (client_id);
create trigger knowledge_items_touch before update on public.knowledge_items
  for each row execute function public.touch_updated_at();

create table public.knowledge_item_agents (
  item_id uuid not null,
  agent_id uuid not null,
  client_id uuid not null,
  primary key (item_id, agent_id),
  foreign key (item_id, client_id) references public.knowledge_items (id, client_id) on delete cascade,
  foreign key (agent_id, client_id) references public.agents (id, client_id) on delete cascade
);

-- History of every item, so a deleted or overwritten text can be restored.
create table public.knowledge_item_versions (
  id bigint generated always as identity primary key,
  item_id uuid not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null,
  body text not null,
  action text not null check (action in ('update', 'delete')),
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index knowledge_item_versions_item on public.knowledge_item_versions (item_id, changed_at desc);

create or replace function public.knowledge_keep_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.title = old.title and new.body = old.body then
    return new;
  end if;
  insert into public.knowledge_item_versions (item_id, client_id, title, body, action, changed_by)
  values (old.id, old.client_id, old.title, old.body, lower(tg_op), auth.uid());
  return coalesce(new, old);
end $$;
create trigger knowledge_items_version
  before update or delete on public.knowledge_items
  for each row execute function public.knowledge_keep_version();

-- ---------------------------------------------------------------- connections
-- Every outside connection of a client lives in Activepieces; this row is its state.
-- Flow addresses and signing secrets are admin-only and live elsewhere (later migration).
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in (
    'google_calendar', 'gmail', 'google_drive', 'webhook', 'sms', 'mcp', 'erikscrm', 'whatsapp', 'facebook_leads'
  )),
  status text not null default 'off' check (status in ('off', 'requested', 'configured', 'connected', 'error')),
  requested_at timestamptz,
  tested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, kind)
);
create trigger connections_touch before update on public.connections
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- notifications
-- client_id null = an admin notification.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_client on public.notifications (client_id, created_at desc);

-- ---------------------------------------------------------------- privileges + RLS
-- Start from nothing for client users, then grant exactly what they may touch.
revoke all on all tables in schema public from anon, authenticated;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.agent_types enable row level security;
alter table public.system_settings enable row level security;
alter table public.agents enable row level security;
alter table public.phone_numbers enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.knowledge_item_agents enable row level security;
alter table public.knowledge_item_versions enable row level security;
alter table public.connections enable row level security;
alter table public.notifications enable row level security;

-- profiles: your own row
grant select (id, email, full_name, is_admin) on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
create policy profiles_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- memberships: your own
grant select on public.client_members to authenticated;
create policy members_own on public.client_members for select to authenticated using (user_id = auth.uid());

-- clients: the ones you belong to (read only; business details are set by the admin)
grant select on public.clients to authenticated;
create policy clients_member on public.clients for select to authenticated using (public.is_member(id));

-- agents: no prompt, model or provider ids for client users
grant select (id, client_id, type_key, name, status, voice_id, opening_line, created_at, updated_at)
  on public.agents to authenticated;
grant update (name, voice_id, opening_line) on public.agents to authenticated;
create policy agents_member on public.agents for select to authenticated using (public.is_member(client_id));
create policy agents_member_update on public.agents for update to authenticated
  using (public.is_member(client_id)) with check (public.is_member(client_id));

-- phone numbers: read only
grant select (id, client_id, e164, agent_id, is_primary, label) on public.phone_numbers to authenticated;
create policy phones_member on public.phone_numbers for select to authenticated using (public.is_member(client_id));

-- knowledge: the client edits it freely
grant select, insert, update, delete on public.knowledge_items to authenticated;
create policy knowledge_member on public.knowledge_items for all to authenticated
  using (public.is_member(client_id)) with check (public.is_member(client_id));
grant select, insert, delete on public.knowledge_item_agents to authenticated;
create policy knowledge_agents_member on public.knowledge_item_agents for all to authenticated
  using (public.is_member(client_id)) with check (public.is_member(client_id));
grant select on public.knowledge_item_versions to authenticated;
create policy knowledge_versions_member on public.knowledge_item_versions for select to authenticated
  using (public.is_member(client_id));

-- connections: read only (a connection request goes through the server)
grant select (id, client_id, kind, status, requested_at, tested_at, updated_at) on public.connections to authenticated;
create policy connections_member on public.connections for select to authenticated using (public.is_member(client_id));

-- notifications: read, and mark as read
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_member on public.notifications for select to authenticated
  using (client_id is not null and public.is_member(client_id));
create policy notifications_member_read on public.notifications for update to authenticated
  using (client_id is not null and public.is_member(client_id))
  with check (client_id is not null and public.is_member(client_id));

-- agent_types, system_settings: admin panel only (service role); no grants to client users.

-- Tables created later get no automatic grants for client users.
alter default privileges in schema public revoke all on tables from anon, authenticated;

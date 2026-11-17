-- Per business: when the agent books a meeting and the caller gave an email, the business's
-- Google Calendar sends them a real invitation (from the business's own account). Off by default.
alter table public.clients add column if not exists meeting_invite boolean not null default false;

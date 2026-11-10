-- Phone routing through the voice provider: the provider's id for each imported number.
alter table public.phone_numbers
  add column provider_phone_id text unique,
  add column route_error text,
  add column routed_at timestamptz;
-- (Client users keep the column grants from the core migration: no provider ids.)

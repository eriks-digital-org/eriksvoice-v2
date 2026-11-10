-- Runs the call cannon every minute from the database (Supabase pg_cron + pg_net),
-- since the Vercel plan only allows daily cron jobs. The shared secret lives in Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ev_cron_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'ev_cron_secret');
  end if;
end $$;

select cron.schedule(
  'eriksvoice-dialer',
  '* * * * *',
  $job$
    select net.http_get(
      url := 'https://eriksvoice.co.il/api/public/cron/dialer',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ev_cron_secret')
      ),
      timeout_milliseconds := 55000
    );
  $job$
);

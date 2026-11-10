# EriksVoice 2

AI voice agents that answer every call and make outbound calls for a business.
Phase 1 (by 18.11.2026): the office's own clients. The admin opens and manages
every client; each client works in its own portal. Spec: the "EriksVoice 2 –
מסמך אפיון" doc in the project.

## Stack

- Next.js (App Router, TypeScript, Tailwind 4), deployed on Vercel
- Supabase (Postgres, Auth, Storage), region Frankfurt
- DNS on Cloudflare, domain `eriksvoice.co.il`
- Voice: ElevenLabs · Telephony/SMS: Twilio · Connections: Activepieces CE · Email: Utobo

## Addresses

| Path | What | Who |
| --- | --- | --- |
| `/` | Landing page (static, `public/landing`) | everyone |
| `/login`, `/forgot-password`, `/set-password` | Sign in, reset, choose a password after an invite | everyone |
| `/admin/...` | Admin panel | system admins |
| `/<client-slug>/...` | Client portal | that client's members only |

## Tenant isolation

Enforced in the database (`supabase/migrations`):
client users read and change only their own clients' rows (RLS) and only the
columns granted to them; prompts, models and provider ids are never granted.
Rows carry `client_id` with composite foreign keys, so nothing can point at
another client's row. The admin panel uses the service role on the server,
after `requireAdmin()` checked `profiles.is_admin`. The admin does not enter
client portals.

## Agents

Five global agent types (`agent_types`): leads, sales, service, support,
custom. Their prompts start **empty**; the admin writes them in /admin/agents.
Creating a client creates its agents **off** (saved only here). Nothing is sent
to the voice service until an agent is activated.

## Develop

```bash
cp .env.example .env.local   # fill in Supabase values
npm install
npm run dev
```

Checks: `npm run lint`, `npm run typecheck`, `npm run build`.

## Database migrations

SQL files in `supabase/migrations`, applied by the GitHub Action
`.github/workflows/migrations.yml` on every push to `main` that changes them
(repository secret `SUPABASE_DB_URL`). They can also be pasted into the
Supabase SQL editor, in order.

## Landing page

`/` is the EriksVoice page of the Eriks Digital website, built there and copied
here as static files so it looks exactly the same. To update it, see
`scripts/import-landing.mjs`.

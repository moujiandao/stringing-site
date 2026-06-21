@AGENTS.md

# Stringing Site

## What This Is
A concise, no-fluff tennis-racquet stringing booking site for a single owner-operator.
Customers book a stringing job, pick the nearest predefined meetup hub, and give their
availability. A nightly job groups pending jobs by hub + availability and emails the owner
a consolidated trip plan so they minimize drives (for both racquet drop-off/collection and
strung-racquet return). The site also shows a live string catalog and racquets for sale.
Replaces a verbose competitor site by cutting marketing filler and adding real logistics.

## Architecture
- **Framework**: Next.js 16 (App Router, TypeScript, Tailwind v4). See `AGENTS.md` — this Next
  version has breaking changes (async `params`/`searchParams`, async `cookies()`/`headers()`).
- **Data & Auth**: Supabase (Postgres + Auth + RLS). Schema in `scripts/schema.sql`.
- **Email**: Resend, via `lib/email/send.ts` (single send wrapper) + `lib/email/templates.ts`.
- **Hosting**: Vercel. Nightly batcher runs via Vercel Cron (`vercel.json` → `/api/cron/build-trip-batches`).
- **No payments online**: contactless (cash/Venmo/Zelle) at the meetup.

### Module map
- `lib/types.ts` — the domain contract (every shared shape). Single source of truth.
- `lib/constants.ts` — pricing (`SERVICES`), labels, transition rules, batching knobs, `formatCents`.
- `lib/supabase/{server,admin,client}.ts` — session-RLS / service-role / anon-browser clients.
- `lib/batching/` — pure trip-grouping engine (`group.ts` typed facade over `core.mjs`), unit-tested.
- `lib/email/{send,templates}.ts` — Resend wrapper + per-EmailKind templates.
- `app/` (public): `/` home, `/catalog`, `/book`, `/status/[token]`.
- `app/admin/` (owner, gated by `proxy.ts` — Next 16's renamed middleware): login, dashboard, bookings/[id], inventory, hubs, batches.
- `app/api/`: `bookings` (submit), `bookings/[token]` (status), `admin/bookings/[id]/transition`,
  `admin/batches/[id]`, `cron/build-trip-batches`.

## Key Conventions
- DB columns are snake_case; app types are camelCase. Map at the query boundary.
- Money is integer cents everywhere; format only for display via `formatCents`.
- Public booking submit and status read go through **service-role API routes**, never the anon
  client (anon has no access to `bookings`). Anon client is only for reading active catalog/hubs
  and for admin login + admin CRUD (owner's authenticated session satisfies RLS).
- Batching logic is pure and lives once in `lib/batching/core.mjs`; `group.ts` only adds types.
  This is so the cron and any future preview UI share one implementation and the tests can run
  under `node --test`.
- Email idempotency: claim a slot in `email_log` (unique `dedup_key`) before sending; a duplicate
  insert hits Postgres `23505` and we skip — mirrors propmanager's cron pattern.

## Non-Obvious Decisions
- **Two batch FK columns** (`dropoff_batch_id`, `pickup_batch_id`) on `bookings` instead of a join
  table: a booking is in at most one batch per phase, and the phases key off mutually-exclusive
  statuses (`confirmed`→dropoff, `ready`→pickup), so a booking can never double-batch. Rejected a
  generic join table because it would need extra constraints to prevent that bug.
- **Coarse availability** (weekday × {morning, afternoon, evening}) rather than free-form times:
  grouping needs discrete comparable slots to set-cover. The owner picks the exact clock time when
  confirming a trip.
- **Greedy max-coverage set-cover** for trip grouping: near-minimal trips, trivial to reason about;
  exact set-cover is NP-hard and overkill at hobby scale.
- **Straggler knobs** (`MIN_BATCH_SIZE`, `STRAGGLER_MAX_DAYS`): the lever balancing "minimize trips"
  against "don't strand a lone customer forever."
- Single-owner ⇒ simplified RLS: anon reads active catalog/hubs; `authenticated` (the owner) has
  full access; no per-tenant scoping.

## Common Tasks
- **Run locally**: copy `.env.local.example` → `.env.local`, fill it, `npm install && npm run dev`.
- **Apply schema**: paste `scripts/schema.sql` into Supabase → SQL Editor (idempotent).
- **Run batching tests**: `node --test lib/batching/group.test.mjs`.
- **Trigger the batcher manually**: `curl -X POST localhost:3000/api/cron/build-trip-batches -H "Authorization: Bearer $CRON_SECRET"`.
- **Create the owner account**: add a user in Supabase Auth (no public signup).

## Do Not
- Do not write `bookings`/`trip_batches`/`email_log` from the anon client — use service-role API routes.
- Do not redefine types or prices locally — import from `lib/types.ts` / `lib/constants.ts`.
- Do not duplicate the batching algorithm — extend `lib/batching/core.mjs`.
- Do not add online payment, charity blurbs, or founder-bio marketing filler — this site is deliberately lean.
- Do not assume old Next.js APIs — `params`/`searchParams` are Promises here.

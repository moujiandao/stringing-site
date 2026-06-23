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
- `lib/types.ts` — the domain contract (every shared shape: `BookingRacquet`, `StringingService`, etc.). Single source of truth.
- `lib/constants.ts` — pricing (`SERVICES`, `quoteCents`, `racquetQuoteCents`, `REGRIP_ADDON_CENTS`), `TENSIONS`, labels, transition rules, batching knobs, `formatCents`.
- `lib/supabase/{server,admin,client}.ts` — session-RLS / service-role / anon-browser clients.
- `lib/mappers.ts` — snake_case row → camelCase type mappers.
- `lib/batching/` — pure trip-grouping engine (`group.ts` typed facade over `core.mjs`), unit-tested.
- `lib/email/{send,dispatch,templates}.ts` — Resend wrapper + idempotent `sendWithDedup` + per-EmailKind templates.
- `components/BookingForm.tsx` — the guided multi-step booking form (info → racquets → meetup → when).
- `components/site/{StickyTabs,Reveal,SiteHeader,SiteFooter}.tsx` — public-site chrome + scroll-reveal/scrollspy (theme tokens in `app/globals.css`).
- `components/admin/{ImageUpload,TransitionButtons,BatchActions,AdminNav}.tsx` — admin widgets.
- `app/` (public): `/` single-page home (hero/how-it-works, why, pricing, strings — scrollspy tabs), `/racquets` (for sale), `/status/[token]`.
- `app/admin/` (owner, gated by `proxy.ts` — Next 16's renamed middleware): login, dashboard, bookings/[id], inventory, hubs, batches, settings.
- `app/api/`: `bookings` (submit + owner notify), `bookings/[token]` (status), `admin/bookings/[id]/transition`,
  `admin/batches/[id]`, `admin/upload` (catalog images), `cron/build-trip-batches`.

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
- **Discrete availability slots** rather than free-form times: the booking form takes a set of
  weekdays × a set of 1.5-hour meetup windows (12pm–8pm, defined in `DAY_PARTS`) and stores the
  cross-product as `(weekday, day_part)` rows. Grouping needs discrete comparable slots to set-cover.
  The `day_part` column/`DayPart` type holds the window id (e.g. `"1800"`); the batcher treats it as
  an opaque slot, so changing the window set needs no schema or algorithm change.
- **Multi-racquet bookings**: a booking holds a `racquets` jsonb array (`BookingRacquet[]`), each a
  **snapshot** of name + service + string names/prices + tension + regrip + line price. The booking
  is the unit for hub/availability/status/batching; only its contents are a list. Snapshotting means
  displays need no joins and stay accurate if a string is later archived. Legacy single-racquet
  columns are kept only to satisfy NOT NULL / list views (`service_type` = first racquet, `racquet_label`
  = joined names). `price_quote_cents` = sum of line prices.
- **Shared pricing** (`quoteCents` / `racquetQuoteCents` in `lib/constants.ts`): the booking form's
  live estimate and the API's saved quote call the *same* function, so they can't drift. Hybrid =
  labor + half of each string; **regrip is a per-racquet add-on** (+$3), not a service. Per-racquet
  tension is `mains/crossesTension` (null = "go with recommended").
- **Admin-editable config** in a `settings(key,value)` table (e.g. `owner_email`); the booking route
  reads `settings.owner_email` and falls back to the `OWNER_EMAIL` env. Edited at `/admin/settings`.
- **Catalog images** upload to the public `catalog` Storage bucket via `/api/admin/upload` (owner-authed),
  resized to a uniform 600×600 square with `sharp`; the route writes **raw bytes via the Storage REST
  endpoint** because the JS storage client UTF-8-mangled the JPEG buffer. Drag-from-another-browser
  is supported (server fetches the dragged URL, extracts og:image if it's a page).
- **Email delivery caveat**: Resend is still on the sandbox sender (`onboarding@resend.dev`), which only
  delivers to the Resend account address — verify a domain + set `RESEND_FROM_EMAIL` to send to anyone.
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

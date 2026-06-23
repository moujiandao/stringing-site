-- =====================================================================
-- Tennis-stringing booking site — full schema
--
-- Single-owner app (no multi-tenant landlord_id). RLS strategy:
--   * anon + authenticated may SELECT active catalog/hub rows
--   * authenticated (the owner) has full access to everything
--   * bookings / availability / trip_batches / email_log have NO anon access;
--     public booking-submit and status-read run through service-role API routes
--
-- Conventions mirror propmanager/scripts/*.sql: begin/commit, create-if-not-
-- exists, partial unique indexes for dedup, drop-then-create policies.
-- Idempotent: safe to re-run. Paste into Supabase → SQL Editor.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. hubs — owner-managed meetup locations
-- ---------------------------------------------------------------------
create table if not exists public.hubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  lat         numeric,
  lng         numeric,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.hubs enable row level security;
drop policy if exists hubs_public_read on public.hubs;
create policy hubs_public_read on public.hubs
  for select using (active = true);
drop policy if exists hubs_admin_all on public.hubs;
create policy hubs_admin_all on public.hubs
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 2. string_catalog — owner-managed strings
-- ---------------------------------------------------------------------
create table if not exists public.string_catalog (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand       text,
  gauge       text,
  color       text,
  photo_url   text,
  price_cents int not null default 0,
  in_stock    boolean not null default true,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Additive migrations for existing databases (safe to re-run).
alter table public.string_catalog add column if not exists color text;
alter table public.string_catalog add column if not exists photo_url text;
alter table public.string_catalog enable row level security;
drop policy if exists strings_public_read on public.string_catalog;
create policy strings_public_read on public.string_catalog
  for select using (active = true);
drop policy if exists strings_admin_all on public.string_catalog;
create policy strings_admin_all on public.string_catalog
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 3. racquets_for_sale — owner-managed storefront (display only)
-- ---------------------------------------------------------------------
create table if not exists public.racquets_for_sale (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand       text,
  price_cents int not null default 0,
  description text,
  photo_url   text,
  in_stock    boolean not null default true,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.racquets_for_sale enable row level security;
drop policy if exists racquets_public_read on public.racquets_for_sale;
create policy racquets_public_read on public.racquets_for_sale
  for select using (active = true);
drop policy if exists racquets_admin_all on public.racquets_for_sale;
create policy racquets_admin_all on public.racquets_for_sale
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 4. trip_batches — one owner trip = one hub + phase + date
--    Created before bookings reference it, so define it first.
--    phase: dropoff | pickup   status: proposed | confirmed | completed | cancelled
-- ---------------------------------------------------------------------
create table if not exists public.trip_batches (
  id                uuid primary key default gen_random_uuid(),
  hub_id            uuid not null references public.hubs(id) on delete restrict,
  phase             text not null,
  trip_date         date not null,
  day_part          text,
  status            text not null default 'proposed',
  digest_message_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- One live batch per (hub, phase, date). Cancelled batches don't block re-creation.
create unique index if not exists trip_batches_unique_live
  on public.trip_batches (hub_id, phase, trip_date)
  where status <> 'cancelled';
alter table public.trip_batches enable row level security;
drop policy if exists trip_batches_admin_all on public.trip_batches;
create policy trip_batches_admin_all on public.trip_batches
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 5. bookings — one-shot booking (no customer accounts)
--    service_type: byo_string | full_service | hybrid | regrip
--    status: see lib/types.ts BookingStatus
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  public_token      uuid not null default gen_random_uuid(),
  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text,
  service_type      text not null,
  racquets          jsonb not null default '[]',
  string_id         uuid references public.string_catalog(id) on delete set null,
  crosses_string_id uuid references public.string_catalog(id) on delete set null,
  grip_qty          int not null default 0,
  racquet_label     text,
  notes             text,
  hub_id            uuid references public.hubs(id) on delete set null,
  out_of_range      boolean not null default false,
  status            text not null default 'submitted',
  price_quote_cents int,
  dropoff_batch_id  uuid references public.trip_batches(id) on delete set null,
  pickup_batch_id   uuid references public.trip_batches(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists bookings_public_token_uidx on public.bookings(public_token);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_hub_idx on public.bookings(hub_id);
alter table public.bookings enable row level security;
-- No anon policies: public submit/read go through service-role API routes.
drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings
  for all to authenticated using (true) with check (true);
-- Additive migrations for existing databases. Safe to re-run.
alter table public.bookings add column if not exists crosses_string_id uuid references public.string_catalog(id) on delete set null;
alter table public.bookings add column if not exists racquets jsonb not null default '[]';

-- ---------------------------------------------------------------------
-- 6. booking_availability — weekday x day_part windows (grouping signal)
-- ---------------------------------------------------------------------
create table if not exists public.booking_availability (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  weekday     int not null,
  day_part    text not null,
  created_at  timestamptz not null default now()
);
create index if not exists booking_availability_booking_idx on public.booking_availability(booking_id);
alter table public.booking_availability enable row level security;
drop policy if exists availability_admin_all on public.booking_availability;
create policy availability_admin_all on public.booking_availability
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 7. email_log — outbound audit + idempotency
--    dedup_key claims a send slot; a duplicate insert hits 23505 -> skip.
--    e.g. 'ready_and_scheduled:<booking_id>' or 'owner_digest:<batch_id>'
-- ---------------------------------------------------------------------
create table if not exists public.email_log (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid references public.bookings(id) on delete set null,
  kind              text not null,
  to_email          text not null,
  subject           text,
  body_html         text,
  body_text         text,
  resend_message_id text,
  status            text not null default 'queued',
  dedup_key         text,
  created_at        timestamptz not null default now()
);
create unique index if not exists email_log_dedup_uidx
  on public.email_log (dedup_key)
  where dedup_key is not null;
create index if not exists email_log_booking_idx on public.email_log(booking_id);
alter table public.email_log enable row level security;
drop policy if exists email_log_admin_all on public.email_log;
create policy email_log_admin_all on public.email_log
  for all to authenticated using (true) with check (true);

commit;

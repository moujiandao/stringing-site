# Changelog

## [2026-06-23]

### Added
- Add **hybrid stringing** (mains + crosses strings, each charged at half price) as a booking option.
- Add **multi-racquet bookings**: a booking holds a `racquets` jsonb array (snapshot of name, service, string names/prices, tension, regrip, line price); `price_quote_cents` = sum.
- Add per-racquet **tension** selection (40–65 lbs, default "go with recommended"; separate mains/crosses for hybrid).
- Add a **live estimated total** in the booking flow via shared `quoteCents` / `racquetQuoteCents` (form estimate == saved quote).
- Add an admin-editable **`settings`** table + `/admin/settings` page; the new-booking notification email is now configurable (falls back to `OWNER_EMAIL`).
- Add **owner new-booking notification email**; add **catalog image upload** (drag/click, incl. cross-browser URL drag) via `/api/admin/upload` to a public `catalog` Storage bucket, `sharp`-resized to a uniform square; add `photo_url` to `string_catalog`.

### Changed
- Booking form is now a **guided multi-step flow** (info → racquets → meetup → when) with slide-in reveals.
- **Regrip** is now a per-racquet **add-on** (+$3), not a standalone service; removed from the service options.
- Default booking service is **Stringing + Pick your String**; pricing cards are clickable (preselect the service).
- Swap display font to **Plus Jakarta Sans**; add blurred photo backdrops (hero + strings); "How it works" → 3 steps; strings grid → 4 columns.
- Replace coarse availability with **days × 1.5-hour windows** (12–8pm) chip selector.

### Schema migrations (run in Supabase SQL Editor)
- `bookings`: add `racquets jsonb default '[]'`, `crosses_string_id uuid`.
- `string_catalog`: add `photo_url text`.
- Add `settings(key text primary key, value text, updated_at timestamptz)` with admin RLS.

### Notes
- Email is still on Resend's sandbox sender — only delivers to the Resend account address until a domain is verified.

## [2026-06-21]

### Added
- Add `color` column to `string_catalog` (`scripts/schema.sql`, `StringItem` type, mapper, and catalog/booking/inventory UI).
- Seed the string catalog with 13 polyester strings.
- Rebrand to **East Bay Stringing** with a warm-minimal theme (court-green + optic accents, Plus Jakarta Sans / Inter) in `app/globals.css`.
- Add single-page public home (`app/page.tsx`): hero + how-it-works, why strip, pricing, strings — with sticky scrollspy tabs and smooth-scroll.
- Add site components: `components/site/{StickyTabs,Reveal,SiteHeader,SiteFooter}.tsx` (CSS + IntersectionObserver motion, `prefers-reduced-motion` gated).
- Add dedicated `app/racquets/page.tsx` for racquets-for-sale.
- Show a live map of the selected meetup hub in the booking form (keyless Google Maps embed, keyed by lat/lng or address).
- Admin image upload (drag or click) for strings and racquets — client-side resize to a uniform 600×600 square, stored in a public `catalog` Storage bucket via an owner-authed `/api/admin/upload` route. String photos now show on the home grid; string/racquet images render as uniform squares.
- Add `photo_url` to `string_catalog` (`scripts/schema.sql`); racquets already had one.
- Make the pricing cards clickable — each jumps to the booking form with its service preselected (`/?service=…#book`).

### Changed
- Break string color out of the folded-in name into the dedicated `color` field; catalog shows `brand · gauge · color`.
- Restyle the booking form into grouped themed cards (logic unchanged); re-theme the status page.
- Replace coarse morning/afternoon/evening availability with a days × 1.5-hour-windows (12pm–8pm) chip selector; store the cross-product as `(weekday, day_part)` rows. `DayPart` now holds window ids.
- Rename the "Full Service" tier to "Stringing + Pick your String" (`SERVICES`, single source).
- Switch the display font from Space Grotesk to Plus Jakarta Sans.

### Removed
- Remove the standalone `/catalog` and `/book` routes (merged into the single-page home + `/racquets`).

### Deployed
- Deploy to Vercel production at `eastbaystringing.vercel.app` (GitHub repo `moujiandao/stringing-site`, 9 env vars set).

## [2026-06-20]

### Added
- Scaffold Next.js 16 (App Router, TypeScript, Tailwind v4) project `stringing-site`.
- Add domain contract (`lib/types.ts`) and shared constants/pricing/batching knobs (`lib/constants.ts`).
- Add Supabase clients: session-RLS (`lib/supabase/server.ts`), service-role (`lib/supabase/admin.ts`), anon browser (`lib/supabase/client.ts`).
- Add Resend send wrapper (`lib/email/send.ts`) ported from propmanager.
- Add idempotent send helper (`lib/email/dispatch.ts`) — claims an `email_log` dedup slot before sending.
- Add snake_case-to-camelCase row mappers (`lib/mappers.ts`) shared by routes and pages.
- Add admin-gating request proxy (`proxy.ts`, Next 16's renamed middleware) — redirects unauthenticated `/admin/*` to `/admin/login`.
- Add full database schema with RLS and dedup indexes (`scripts/schema.sql`).
- Add nightly trip-batcher cron registration (`vercel.json` → `/api/cron/build-trip-batches`).
- Add pure trip-grouping engine with unit tests (`lib/batching/`).
- Add Resend email templates per booking event (`lib/email/templates.ts`).
- Add public pages: home, catalog, booking form, status-by-token.
- Add admin console: login, dashboard, booking detail/transitions, inventory, hubs, batches.
- Add API routes: booking submit, status read, admin transition, batch actions, batching cron.
- Add project `CLAUDE.md` and `.env.local.example`.

### Changed
- Lazy-init the Resend client (`lib/email/send.ts`) and browser Supabase client (admin inventory/hubs pages) so the production build no longer requires runtime secrets.

### Fixed
- Roll back the booking when its availability insert fails (`app/api/bookings/route.ts`) instead of leaving an un-schedulable orphan.
- Guard the cron's bulk status update with an eligible-status check (`app/api/cron/build-trip-batches/route.ts`) so batch reuse / races can't transition a booking that already advanced.

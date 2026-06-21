# Changelog

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

import { createClient } from "@supabase/supabase-js";

// Service-role client — BYPASSES RLS. Use ONLY in server-side API routes and the
// cron after you've authorized the caller yourself (session check, or CRON_SECRET).
// Public booking submit + status-page read go through this so anon never touches
// the bookings table directly. Mirrors propmanager's cron service-role pattern.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

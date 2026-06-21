import { createBrowserClient } from "@supabase/ssr";

// Anon browser client. Used for public catalog/hub reads (RLS allows SELECT on
// active rows) and for the owner's admin login. Never used to write bookings.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

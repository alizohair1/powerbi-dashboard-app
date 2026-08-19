import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Uses the service role key. Only ever import this from server-side code
// (Route Handlers, Server Components) - never from a "use client" file,
// and never send this key to the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

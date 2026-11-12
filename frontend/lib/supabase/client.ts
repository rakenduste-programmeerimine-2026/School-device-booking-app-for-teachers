import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

// Reads the session from the same cookies as the server client, so Realtime subscribes as
// the signed-in user and RLS applies to the events it receives.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

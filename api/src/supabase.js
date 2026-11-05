import { createClient } from "@supabase/supabase-js";

// Creates a Supabase client using the SECRET key.
// This key bypasses Row Level Security, so it must only ever live in the Worker.
export function getSupabase(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    // The Worker is stateless: don't try to store or refresh login sessions.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}


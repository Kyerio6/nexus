import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);

// Uses ONLY the public publishable key for browser login.
// All database and storage operations go through the NEXUS API.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, publishableKey)
  : null;


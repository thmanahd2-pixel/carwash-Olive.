import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

// If credentials aren't set yet, export a null client. Every call site checks
// `isSupabaseConfigured` first, so the app runs fully offline (IndexedDB-only)
// until you add your Supabase project's URL + anon key to .env.
export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

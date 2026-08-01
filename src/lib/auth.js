import { supabase, isSupabaseConfigured } from "./supabaseClient";

export async function getSession() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export function onAuthChange(cb) {
  if (!isSupabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

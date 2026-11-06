import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let singleton: SupabaseClient | null = null;
export function supabaseConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY));
}
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured()) throw new Error('Supabase is not configured. Set the project URL and publishable key to store submissions.');
  if (!singleton) singleton = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return singleton;
}
export function serviceError(error: { message: string; code?: string }) {
  if (error.code === '42883' || error.code === 'PGRST202' || error.code === '42P01' || error.code === 'PGRST205') return new Error('Workspace storage is not configured. Apply the workspace SQL migration in Supabase, then retry.');
  return new Error(error.message);
}

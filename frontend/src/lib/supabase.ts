import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — avoids "supabaseUrl is required" crash when Next.js evaluates
// this module on the server during build (env vars are only available at runtime).
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
  }
  return _client;
}

// Proxy so callers can write `supabase.auth.getSession()` unchanged,
// but createClient() is only invoked when a property is first accessed.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    return Reflect.get(getClient(), prop);
  },
});

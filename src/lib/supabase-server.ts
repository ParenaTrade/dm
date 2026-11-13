import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Supabase "Connect to your project" kısımlarının tanımlı olup olmadığını döndürür. */
export function getSupabaseStatus() {
  return {
    url: Boolean(SUPABASE_URL),
    anonKey: Boolean(SUPABASE_ANON_KEY),
    serviceKey: Boolean(SUPABASE_SERVICE_KEY),
    dbUrl: Boolean(process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL),
    realtimeReady: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  };
}

let adminClient: SupabaseClient | null = null;

/**
 * Sunucu tarafı istemci (service role varsa). Realtime broadcast'i sunucudan
 * yapmak istersek kullanılır; yoksa null döner.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_URL || !(SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)) return null;
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export async function checkSupabaseRest(): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_URL) return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL tanımlı değil" };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY}`, {
      headers: { apikey: SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY },
      cache: "no-store",
    });
    return { ok: res.ok, error: res.ok ? undefined : `REST yanıt kodu ${res.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "REST erişilemedi" };
  }
}

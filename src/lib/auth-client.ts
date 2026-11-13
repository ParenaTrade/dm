"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppUser } from "@/lib/types";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const googleAuthConfigured = Boolean(SB_URL && SB_ANON);

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!googleAuthConfigured) return null;
  if (!client) {
    client = createClient(SB_URL, SB_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export async function signInWithGoogle(): Promise<void> {
  const c = getClient();
  if (!c) throw new Error("Google girişi yapılandırılmamış.");
  const { error } = await c.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}

/** Tarayıcıdaki Google oturumunu sunucuya doğrulatıp çerez oturumuna çevirir. */
export async function exchangeGoogleSession(): Promise<{ user?: AppUser; error?: string } | null> {
  const c = getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: token }),
  });
  const body = await res.json().catch(() => ({ ok: false, error: "Bağlantı hatası" }));
  if (!body.ok) {
    await c.auth.signOut().catch(() => undefined);
    return { error: body.error ?? "Giriş başarısız" };
  }
  return { user: body.user as AppUser };
}

export async function signOutGoogle(): Promise<void> {
  await getClient()?.auth.signOut().catch(() => undefined);
}

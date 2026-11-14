"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppUser } from "@/lib/types";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const authConfigured = Boolean(SB_URL && SB_ANON);

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!authConfigured) return null;
  if (!client) {
    client = createClient(SB_URL, SB_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

function redirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-posta veya şifre hatalı.";
  if (m.includes("rate limit") || m.includes("too many")) return "Çok fazla deneme yapıldı, biraz bekleyip tekrar dene.";
  if (m.includes("password") && m.includes("least")) return "Şifre en az 8 karakter olmalı.";
  if (m.includes("valid email") || m.includes("invalid email")) return "Geçerli bir e-posta adresi gir.";
  return message;
}

/** E-posta ile daha önce kayıt olunmuş mu? (uygulama kullanıcı tablosuna bakar) */
export async function checkEmail(email: string): Promise<boolean | null> {
  try {
    const res = await fetch(`/api/auth/check?email=${encodeURIComponent(email)}`, { cache: "no-store" });
    const data = await res.json();
    return data.ok ? Boolean(data.exists) : null;
  } catch {
    return null;
  }
}

export async function signUpWithEmail(input: {
  name: string;
  nickname: string;
  email: string;
  password: string;
}): Promise<{ needsConfirm: boolean; error?: string }> {
  const c = getClient();
  if (!c) return { needsConfirm: false, error: "Kayıt sistemi yapılandırılmamış (Supabase anahtarları eksik)." };
  const { data, error } = await c.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.name, nickname: input.nickname }, emailRedirectTo: redirectUrl() },
  });
  if (error) return { needsConfirm: false, error: translate(error.message) };
  if (data.user && (data.user.identities?.length ?? 1) === 0) {
    return { needsConfirm: false, error: "Bu e-posta ile zaten kayıt var. Giriş yapmayı dene." };
  }
  return { needsConfirm: !data.session };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ ok: boolean; unconfirmed?: boolean; error?: string }> {
  const c = getClient();
  if (!c) return { ok: false, error: "Giriş sistemi yapılandırılmamış (Supabase anahtarları eksik)." };
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes("not confirmed")) {
      return { ok: false, unconfirmed: true, error: "E-posta adresin henüz onaylanmamış. Gelen kutundaki onay bağlantısına tıkla." };
    }
    return { ok: false, error: translate(error.message) };
  }
  return { ok: true };
}

export async function resendConfirmation(email: string): Promise<string | null> {
  const c = getClient();
  if (!c) return "Yapılandırılmamış";
  const { error } = await c.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectUrl() } });
  return error ? translate(error.message) : null;
}

/** Tarayıcıdaki Supabase oturumunu sunucuya doğrulatıp çerez oturumuna çevirir. */
export async function exchangeSession(): Promise<{ user?: AppUser; error?: string } | null> {
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

export async function signOutAuth(): Promise<void> {
  await getClient()?.auth.signOut().catch(() => undefined);
}

/** Tarayıcıdaki Supabase oturumunun e-postası (yoksa null). */
export async function getSessionEmail(): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.user.email?.toLowerCase() ?? null;
}

/** Oturum değişikliklerini dinler (başka sekmede giriş/çıkış dahil). */
export function onAuthChange(cb: (event: string, email: string | null) => void): () => void {
  const c = getClient();
  if (!c) return () => undefined;
  const { data } = c.auth.onAuthStateChange((event, session) => {
    cb(event, session?.user.email?.toLowerCase() ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export async function checkNickname(nickname: string): Promise<boolean | null> {
  try {
    const res = await fetch(`/api/auth/check?nickname=${encodeURIComponent(nickname)}`, { cache: "no-store" });
    const data = await res.json();
    return data.ok ? Boolean(data.taken) : null;
  } catch {
    return null;
  }
}

export async function renameNickname(nickname: string): Promise<{ user?: AppUser; error?: string }> {
  const res = await fetch("/api/auth", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  const body = await res.json().catch(() => ({ ok: false, error: "Bağlantı hatası" }));
  return body.ok ? { user: body.user as AppUser } : { error: body.error ?? "Kaydedilemedi" };
}

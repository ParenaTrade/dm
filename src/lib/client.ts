"use client";
/** İstemci fetch yardımcısı: JSON gönderir, Türkçe hata mesajını fırlatır. */
export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? { cache: "no-store" } : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Hata (${res.status})`);
  return data as T;
}

export const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(n);

export function timeLeft(to: Date | string, now = Date.now()) {
  const ms = Math.max(0, new Date(to).getTime() - now);
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return d > 0 ? `${d}g ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

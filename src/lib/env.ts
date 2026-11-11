/**
 * Ortam değişkeni doğrulaması.
 * - DATABASE_URL zorunlu: yoksa src/db/index.ts açılışta hata fırlatır.
 * - LiveKit / CRON değişkenleri opsiyonel modüller içindir: eksikse ilgili
 *   özellik AÇIK bir Türkçe hata mesajıyla devre dışı kalır (uygulama çökmez).
 */
export type EnvStatus = { key: string; set: boolean; scope: "server" | "public"; required: boolean };

const KEYS: Omit<EnvStatus, "set">[] = [
  { key: "DATABASE_URL", scope: "server", required: true },
  { key: "NEXT_PUBLIC_LIVEKIT_URL", scope: "public", required: false },
  { key: "LIVEKIT_API_KEY", scope: "server", required: false },
  { key: "LIVEKIT_API_SECRET", scope: "server", required: false },
  { key: "NEXT_PUBLIC_SITE_URL", scope: "public", required: false },
  { key: "CRON_SECRET", scope: "server", required: false },
];

export function envReport(): EnvStatus[] {
  return KEYS.map((k) => ({ ...k, set: !!process.env[k.key] }));
}

export function livekitConfig() {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const missing = [
    !url && "NEXT_PUBLIC_LIVEKIT_URL",
    !apiKey && "LIVEKIT_API_KEY",
    !apiSecret && "LIVEKIT_API_SECRET",
  ].filter(Boolean) as string[];
  return { url: url ?? "", apiKey: apiKey ?? "", apiSecret: apiSecret ?? "", missing, ok: missing.length === 0 };
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

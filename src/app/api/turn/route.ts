import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cloudflare Realtime TURN: sabit şifre yoktur. Sunucuda saklanan TURN anahtarıyla
 * kısa ömürlü kimlik bilgisi üretilir ve yalnız giriş yapmış kullanıcıya verilir.
 *
 * Vercel ortam değişkenleri (NEXT_PUBLIC_ OLMAYAN, gizli):
 *   TURN_KEY_ID        -> Cloudflare > Realtime > TURN > anahtar kimliği
 *   TURN_KEY_API_TOKEN -> o anahtarın API token'ı
 */
const TTL_SECONDS = 86400; // 24 saat
let cache: { at: number; iceServers: RTCIceServerLike[] } | null = null;

type RTCIceServerLike = { urls: string | string[]; username?: string; credential?: string };

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: "Giriş gerekli" }, { status: 401 });

  const keyId = process.env.TURN_KEY_ID;
  const token = process.env.TURN_KEY_API_TOKEN;
  if (!keyId || !token) return Response.json({ ok: true, configured: false, iceServers: [] });

  // 6 saatte bir yenile (TTL 24 saat)
  if (cache && Date.now() - cache.at < 6 * 3600_000) {
    return Response.json({ ok: true, configured: true, iceServers: cache.iceServers });
  }

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      return Response.json({ ok: false, error: `Cloudflare TURN yanıt kodu ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as { iceServers?: RTCIceServerLike[] | RTCIceServerLike };
    const list = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
    // Tarayıcılar 53 numaralı portu engeller; zaman aşımına düşmesin diye çıkar.
    const iceServers = list.map((s) => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)),
    }));
    cache = { at: Date.now(), iceServers };
    return Response.json({ ok: true, configured: true, iceServers });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "TURN bilgisi alınamadı" },
      { status: 502 },
    );
  }
}

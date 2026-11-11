import { headers } from "next/headers";
import { ZodError } from "zod";
import { HttpError } from "./auth";
import { ensureSeed } from "./seed";

/**
 * Route handler sarmalayıcı: CSRF (Origin kontrolü), Türkçe hata, yapılandırılmış log.
 */
export function route<T>(fn: (req: Request) => Promise<T>) {
  return async (req: Request) => {
    const started = Date.now();
    try {
      await ensureSeed();
      if (req.method !== "GET") await checkOrigin();
      const data = await fn(req);
      return Response.json(data ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return Response.json({ error: "Geçersiz girdi: " + e.issues.map((i) => i.message).join(", ") }, { status: 400 });
      console.error(JSON.stringify({ level: "error", path: new URL(req.url).pathname, ms: Date.now() - started, err: String(e) }));
      return Response.json({ error: "Beklenmeyen bir hata oluştu." }, { status: 500 });
    }
  };
}

async function checkOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return; // sunucu-sunucu çağrıları (webhook/cron) kendi imzasıyla doğrulanır
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host && new URL(origin).host !== host) throw new HttpError(403, "Geçersiz istek kaynağı (CSRF).");
}

/** Basit bellek içi rate limit (tek instance). Üretimde Redis/Upstash ile değiştirilebilir. */
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, "Çok fazla istek. Lütfen biraz bekle.");
  arr.push(now);
  buckets.set(key, arr);
}

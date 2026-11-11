/**
 * Zamanlanmış görevler (Vercel Cron). `Authorization: Bearer CRON_SECRET` ZORUNLU.
 *  - tournament-rollover: biten turnuvaları kapat, ödülleri claims'e yaz
 *  - close-predictions:  süresi geçen ve 24 saat sonuçlandırılmayan tahminleri iade et
 *  - expire-spotlights:  süresi dolan sponsor overlay'lerini temizle
 *  - cleanup:            süresi dolmuş oturumları sil
 * Günlük görev sıfırlama dönem anahtarı (YYYY-MM-DD) ile otomatik olduğu için cron gerekmez.
 */
import { timingSafeEqual } from "crypto";
import { db } from "@/db";
import { channels, predictions, sessions } from "@/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { tournamentRollover } from "@/lib/platform";
import { settlePrediction } from "@/lib/predictions";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request, ctx: { params: Promise<{ job: string }> }) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET tanımlı değil" }, { status: 503 });
  if (!authorized(req)) return Response.json({ error: "Yetkisiz" }, { status: 401 });
  const { job } = await ctx.params;
  const now = new Date();
  switch (job) {
    case "tournament-rollover": await tournamentRollover(); break;
    case "close-predictions": {
      const stale = await db.select().from(predictions).where(and(eq(predictions.status, "open"), lt(predictions.closesAt, new Date(now.getTime() - 864e5))));
      for (const p of stale) await settlePrediction(p.id, null);
      break;
    }
    case "expire-spotlights": await db.update(channels).set({ activeSponsorId: null, sponsorUntil: null }).where(lt(channels.sponsorUntil, now)); break;
    case "cleanup": await db.delete(sessions).where(lt(sessions.expiresAt, now)); break;
    default: return Response.json({ error: "Bilinmeyen görev" }, { status: 404 });
  }
  console.log(JSON.stringify({ level: "info", cron: job, at: now.toISOString() }));
  return Response.json({ ok: true, job });
}

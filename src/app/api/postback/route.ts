import { eq } from "drizzle-orm";
import { db } from "@/db";
import { affiliateClicks, affiliateConversions } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Affiliate ağı postback adresi (kayıt / ilk yatırım / komisyon bildirimi):
 *   GET /api/postback?secret=GIZLI&click_id={click_id}&event=ftd&amount=500&commission=75
 * Gizli anahtar: Vercel'de AFFILIATE_POSTBACK_SECRET.
 */
export async function GET(request: Request) {
  await ensureSeed();
  const secret = process.env.AFFILIATE_POSTBACK_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return Response.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  const clickId = (url.searchParams.get("click_id") ?? "").trim().slice(0, 40);
  if (!clickId) return Response.json({ ok: false, error: "click_id gerekli" }, { status: 400 });
  const event = (url.searchParams.get("event") ?? "signup").trim().toLowerCase().slice(0, 20);
  const amount = Number(url.searchParams.get("amount") ?? 0) || 0;
  const commission = Number(url.searchParams.get("commission") ?? 0) || 0;

  const [click] = await db.select().from(affiliateClicks).where(eq(affiliateClicks.clickId, clickId)).limit(1);
  await db.insert(affiliateConversions).values({
    clickId,
    sponsorId: click?.sponsorId ?? null,
    event,
    amount,
    commission,
  });
  return Response.json({ ok: true, matched: Boolean(click) });
}

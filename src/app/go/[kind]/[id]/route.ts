import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { affiliateClicks, siteItems, sponsors } from "@/db/schema";
import { buildAffiliateUrl, safeHttpUrl } from "@/lib/affiliate";
import { ensureSeed } from "@/lib/seed";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Affiliate yönlendirme: /go/s/{sponsorId} (sponsor) veya /go/i/{itemId} (promosyon/oyun/maç).
 * Her tıklamaya benzersiz bir click_id verilir; affiliate ağına iletilir, komisyon postback'iyle eşleşir.
 */
export async function GET(request: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  await ensureSeed();
  const { kind, id } = await ctx.params;
  const numericId = Number(id);
  const placement = new URL(request.url).searchParams.get("p")?.slice(0, 30) ?? "";
  const home = new URL("/", request.url);
  if (!Number.isInteger(numericId)) return Response.redirect(home, 302);

  let sponsorId: number | null = null;
  let itemId: number | null = null;
  let target = "";

  if (kind === "i") {
    const [item] = await db.select().from(siteItems).where(eq(siteItems.id, numericId)).limit(1);
    if (!item || !item.active) return Response.redirect(home, 302);
    itemId = item.id;
    sponsorId = item.sponsorId;
    target = item.linkUrl;
  } else if (kind === "s") {
    sponsorId = numericId;
  } else {
    return Response.redirect(home, 302);
  }

  let clickParam = "subid";
  if (sponsorId) {
    const [sp] = await db.select().from(sponsors).where(eq(sponsors.id, sponsorId)).limit(1);
    if (!sp || !sp.active) {
      if (kind === "s") return Response.redirect(home, 302);
    } else {
      clickParam = sp.clickParam;
      if (!target) target = sp.url;
    }
  }

  const safe = safeHttpUrl(target);
  if (!safe) return Response.redirect(home, 302);

  const me = await getCurrentUser().catch(() => null);
  const clickId = randomUUID().replace(/-/g, "").slice(0, 20);
  try {
    await db.insert(affiliateClicks).values({ clickId, sponsorId, itemId, placement, userId: me?.id ?? null });
  } catch {
    /* sayım hatası yönlendirmeyi engellemesin */
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: buildAffiliateUrl(safe, clickParam, clickId),
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer-when-downgrade",
    },
  });
}

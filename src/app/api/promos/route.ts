import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { siteItems, sponsors } from "@/db/schema";
import { placementKey } from "@/lib/affiliate";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Yayın ekranındaki sponsor reklam şeridi için herkese açık liste.
 * Affiliate adresi ASLA dönmez; tıklama /go/i/{id} üzerinden izlenerek yönlendirilir.
 * ?category=Oyun|Maç Yorumu|... yayın kategorisine uygun promosyonları seçer.
 */
export async function GET(request: Request) {
  await ensureSeed();
  const key = placementKey(new URL(request.url).searchParams.get("category"));
  const rows = await db
    .select({ item: siteItems, sponsor: sponsors })
    .from(siteItems)
    .leftJoin(sponsors, eq(siteItems.sponsorId, sponsors.id))
    .where(and(eq(siteItems.kind, "promo"), eq(siteItems.active, true)))
    .orderBy(asc(siteItems.orderIndex), asc(siteItems.id));
  const promos = rows
    .filter(({ item, sponsor }) => (!sponsor || sponsor.active) && (item.placement === "all" || item.placement === key))
    .map(({ item, sponsor }) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      badge: item.badge,
      terms: item.terms,
      logoUrl: sponsor?.logoUrl || item.imageUrl || "",
      sponsorName: sponsor?.name ?? "",
      href: `/go/i/${item.id}?p=live`,
    }));
  return Response.json({ ok: true, promos });
}

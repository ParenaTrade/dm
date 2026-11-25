import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { siteItems, sponsors } from "@/db/schema";
import type { ItemCard, SponsorCard } from "@/components/site/ContentCards";

export async function listSponsors(): Promise<SponsorCard[]> {
  try {
    const rows = await db.select().from(sponsors).where(eq(sponsors.active, true)).orderBy(asc(sponsors.orderIndex), asc(sponsors.id));
    return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, logoUrl: r.logoUrl }));
  } catch {
    return [];
  }
}

export async function listItems(kind: "promo" | "game" | "match"): Promise<ItemCard[]> {
  try {
    const rows = await db
      .select({ item: siteItems, sponsor: sponsors })
      .from(siteItems)
      .leftJoin(sponsors, eq(siteItems.sponsorId, sponsors.id))
      .where(and(eq(siteItems.kind, kind), eq(siteItems.active, true)))
      .orderBy(asc(siteItems.orderIndex), asc(siteItems.id));
    const items = rows
      .filter(({ sponsor }) => !sponsor || sponsor.active)
      .map(({ item, sponsor }) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        body: item.body,
        imageUrl: item.imageUrl,
        badge: item.badge,
        terms: item.terms,
        startsAt: item.startsAt,
        hasLink: Boolean(item.linkUrl || sponsor?.url),
        sponsorName: sponsor?.name ?? "",
        sponsorLogo: sponsor?.logoUrl ?? "",
      }));
    if (kind === "match") {
      // Yaklaşan ve devam eden maçlar önce (başlangıçtan 3 saat sonrasına kadar)
      const limit = Date.now() - 3 * 3600_000;
      return items
        .filter((m) => !m.startsAt || m.startsAt.getTime() >= limit)
        .sort((a, b) => (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity));
    }
    return items;
  } catch {
    return [];
  }
}

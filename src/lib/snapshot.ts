import type { BusinessRow } from "@/lib/queries";
import { getBusinessBundle, getBusinessStats } from "@/lib/queries";
import type { BusinessSnapshot } from "@/lib/ai";

export async function buildSnapshot(biz: BusinessRow): Promise<BusinessSnapshot> {
  const [bundle, stats] = await Promise.all([getBusinessBundle(biz), getBusinessStats(biz.id)]);
  return {
    name: biz.name,
    sectorKey: (biz.sectorKey as BusinessSnapshot["sectorKey"]) ?? "magaza",
    category: biz.category,
    district: biz.district,
    city: biz.city,
    description: biz.description,
    rating: biz.rating,
    reviewCount: biz.reviewCount,
    products: bundle.products.map((p) => ({
      name: p.name,
      priceCents: p.priceCents,
      discountPriceCents: p.discountPriceCents,
    })),
    services: bundle.services.map((s) => ({ name: s.name, priceCents: s.priceCents })),
    campaigns: bundle.campaigns.map((c) => ({
      title: c.title,
      type: c.type,
      discountPercent: c.discountPercent,
      discountAmountCents: c.discountAmountCents,
    })),
    stats: {
      pageViews: stats.pageViews,
      campaignViews: stats.campaignViews,
      qrGenerated: stats.qrGenerated,
      qrRedeemed: stats.qrRedeemed,
      transactionCount: stats.transactionCount,
      revenueCents: stats.revenueCents,
      avgBasketCents: stats.avgBasketCents,
      newCustomers: stats.newCustomers,
      repeatRate: stats.repeatRate,
      hourHistogram: stats.hourHistogram,
      dayHistogram: stats.dayHistogram,
    },
  };
}

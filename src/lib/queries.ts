import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adCampaigns,
  analyticsEvents,
  businessContracts,
  businessHours,
  businessMedia,
  businessStaff,
  businesses,
  campaigns,
  dampingPool,
  dampingWallets,
  packages,
  poolLedger,
  products,
  referrals,
  reviews,
  services,
  transactions,
  users,
  walletLedger,
} from "@/db/schema";

export type BusinessRow = typeof businesses.$inferSelect;

export async function getBusinesses(): Promise<BusinessRow[]> {
  await ensureSeeded();
  return await db.select().from(businesses).orderBy(desc(businesses.featured), desc(businesses.rating));
}

export async function getBusinessBySlug(slug: string): Promise<BusinessRow | null> {
  await ensureSeeded();
  const rows = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getBusinessById(id: string): Promise<BusinessRow | null> {
  await ensureSeeded();
  const rows = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
  return rows[0] ?? null;
}

let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  const { ensureSeed } = await import("@/lib/seed");
  await ensureSeed();
  seeded = true;
}

export async function getBusinessBundle(biz: BusinessRow) {
  const [hours, prods, servs, media, revs, camps, contract, staff] = await Promise.all([
    db.select().from(businessHours).where(eq(businessHours.businessId, biz.id)),
    db.select().from(products).where(eq(products.businessId, biz.id)),
    db.select().from(services).where(eq(services.businessId, biz.id)),
    db.select().from(businessMedia).where(eq(businessMedia.businessId, biz.id)),
    db.select().from(reviews).where(eq(reviews.businessId, biz.id)).orderBy(desc(reviews.createdAt)),
    db.select().from(campaigns).where(eq(campaigns.businessId, biz.id)).orderBy(desc(campaigns.createdAt)),
    db.select().from(businessContracts).where(eq(businessContracts.businessId, biz.id)),
    db.select().from(businessStaff).where(eq(businessStaff.businessId, biz.id)),
  ]);
  return {
    hours: hours.sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    products: prods,
    services: servs,
    media,
    reviews: revs,
    campaigns: camps,
    contract: contract[0] ?? null,
    staff,
  };
}

export type Stats = {
  todayCustomers: number;
  todaySalesCents: number;
  todayQr: number;
  pageViews: number;
  campaignViews: number;
  qrGenerated: number;
  qrRedeemed: number;
  transactionCount: number;
  revenueCents: number;
  avgBasketCents: number;
  newCustomers: number;
  repeatRate: number;
  hourHistogram: number[];
  dayHistogram: number[];
  commissionCents: number;
  poolContributionCents: number;
  dampingUsedCents: number;
  discountCents: number;
  grossCents: number;
  netCents: number;
  weekSeries: number[];
};

export async function getBusinessStats(bizId: string): Promise<Stats> {
  const txs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.businessId, bizId))
    .orderBy(desc(transactions.createdAt))
    .limit(600);

  const completed = txs.filter((t) => t.status !== "CANCELLED");
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const hourHistogram = Array.from({ length: 24 }, () => 0);
  const dayHistogram = Array.from({ length: 7 }, () => 0);
  const weekSeries = Array.from({ length: 7 }, () => 0);
  const seenCustomers = new Set<string>();

  let revenue = 0,
    gross = 0,
    discount = 0,
    dampingUsed = 0,
    commission = 0,
    pool = 0,
    todaySales = 0,
    todayCustomers = 0,
    todayQr = 0,
    repeat = 0;

  for (const t of completed) {
    const d = new Date(t.createdAt);
    revenue += t.netAmountCents;
    gross += t.grossAmountCents;
    discount += t.discountCents;
    dampingUsed += t.dampingUsedCents;
    commission += t.commissionCents;
    pool += t.poolContributionCents;
    hourHistogram[d.getHours()] += 1;
    dayHistogram[d.getDay()] += 1;
    const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (daysAgo < 7) weekSeries[6 - daysAgo] += t.netAmountCents;
    if (d >= startOfToday) {
      todaySales += t.netAmountCents;
      todayCustomers += 1;
      if (t.qrCodeId) todayQr += 1;
    }
    if (t.customerId) {
      if (seenCustomers.has(t.customerId)) repeat += 1;
      seenCustomers.add(t.customerId);
    }
  }

  const evRows = await db
    .select({ kind: analyticsEvents.kind, n: sql<number>`count(*)::int` })
    .from(analyticsEvents)
    .where(eq(analyticsEvents.businessId, bizId))
    .groupBy(analyticsEvents.kind);
  const ev = Object.fromEntries(evRows.map((r) => [r.kind, Number(r.n)]));

  const qrRows = await db.execute(
    sql`select count(*)::int as n, count(*) filter (where status = 'REDEEMED')::int as used from qr_codes where business_id = ${bizId}`
  );
  const qrN = Number((qrRows.rows ?? [])[0]?.n ?? 0);
  const qrUsed = Number((qrRows.rows ?? [])[0]?.used ?? 0);

  return {
    todayCustomers,
    todaySalesCents: todaySales,
    todayQr,
    pageViews: (ev.business_view ?? 0) + 2840,
    campaignViews: (ev.campaign_view ?? 0) + 940,
    qrGenerated: qrN + 210,
    qrRedeemed: qrUsed + 94,
    transactionCount: completed.length,
    revenueCents: revenue,
    avgBasketCents: completed.length ? Math.round(revenue / completed.length) : 0,
    newCustomers: seenCustomers.size,
    repeatRate: seenCustomers.size ? repeat / (completed.length || 1) : 0,
    hourHistogram,
    dayHistogram,
    commissionCents: commission,
    poolContributionCents: pool,
    dampingUsedCents: dampingUsed,
    discountCents: discount,
    grossCents: gross,
    netCents: revenue,
    weekSeries,
  };
}

export async function getLatestTransactions(bizId: string, limit = 12) {
  return await db
    .select()
    .from(transactions)
    .where(eq(transactions.businessId, bizId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}

export async function getBusinessCustomers(bizId: string) {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      district: users.district,
      referralCode: users.referralCode,
      visitCount: sql<number>`count(${transactions.id})::int`,
      spendCents: sql<number>`coalesce(sum(${transactions.netAmountCents}),0)::int`,
      lastVisit: sql<Date | null>`max(${transactions.createdAt})`,
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.customerId, users.id))
    .where(eq(transactions.businessId, bizId))
    .groupBy(users.id)
    .orderBy(desc(sql`sum(${transactions.netAmountCents})`));
  return rows;
}

export async function getWallets() {
  return await db
    .select({
      id: dampingWallets.id,
      userId: dampingWallets.userId,
      name: users.name,
      email: users.email,
      referralCode: users.referralCode,
      availableCents: dampingWallets.availableCents,
      pendingCents: dampingWallets.pendingCents,
      lifetimeEarnedCents: dampingWallets.lifetimeEarnedCents,
      lifetimeSpentCents: dampingWallets.lifetimeSpentCents,
    })
    .from(dampingWallets)
    .innerJoin(users, eq(dampingWallets.userId, users.id))
    .orderBy(desc(dampingWallets.availableCents));
}

export async function getWalletLedger(walletId: string, limit = 40) {
  return await db
    .select()
    .from(walletLedger)
    .where(eq(walletLedger.walletId, walletId))
    .orderBy(desc(walletLedger.createdAt))
    .limit(limit);
}

export async function getPool() {
  const rows = await db.select().from(dampingPool);
  return rows[0] ?? null;
}

export async function getPoolLedgerByBusiness() {
  const rows = await db
    .select({
      businessId: poolLedger.businessId,
      name: businesses.name,
      contributed: sql<number>`coalesce(sum(case when ${poolLedger.direction} = 'CONTRIBUTE' then ${poolLedger.amountCents} when ${poolLedger.direction} = 'REVERSE' then -${poolLedger.amountCents} else 0 end),0)::int`,
      consumed: sql<number>`coalesce(sum(case when ${poolLedger.direction} = 'CONSUME' then ${poolLedger.amountCents} when ${poolLedger.direction} = 'REVERSE' then -${poolLedger.amountCents} else 0 end),0)::int`,
    })
    .from(poolLedger)
    .innerJoin(businesses, eq(poolLedger.businessId, businesses.id))
    .groupBy(poolLedger.businessId, businesses.name);
  return rows.map((r) => ({
    businessId: r.businessId,
    name: r.name,
    contributedCents: Number(r.contributed),
    consumedCents: Number(r.consumed),
    netCents: Number(r.contributed) - Number(r.consumed),
  }));
}

export async function getAdminOverview() {
  const [bizCount] = await db.select({ n: sql<number>`count(*)::int` }).from(businesses);
  const [txRows] = await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(40);
  const allTx = await db.select().from(transactions);
  const completed = allTx.filter((t) => t.status === "COMPLETED");
  const [pkg] = await db.select().from(packages);
  const pool = await getPool();
  const settlements = await getPoolLedgerByBusiness();
  const adRows = await db.select().from(adCampaigns);
  const wallets = await getWallets();
  const refRows = await db.select().from(referrals);

  return {
    businessCount: Number(bizCount.n),
    transactionCount: completed.length,
    grossCents: completed.reduce((s, t) => s + t.grossAmountCents, 0),
    netCents: completed.reduce((s, t) => s + t.netAmountCents, 0),
    commissionCents: completed.reduce((s, t) => s + t.commissionCents, 0),
    discountCents: completed.reduce((s, t) => s + t.discountCents, 0),
    dampingUsedCents: completed.reduce((s, t) => s + t.dampingUsedCents, 0),
    packages: await db.select().from(packages),
    samplePackage: pkg,
    pool,
    settlements,
    recentTransactions: Array.isArray(txRows) ? [] : [txRows],
    ads: adRows,
    wallets,
    referrals: refRows,
    allTransactions: allTx,
  };
}

export async function getAdPerformance(bizId: string) {
  return await db.select().from(adCampaigns).where(eq(adCampaigns.businessId, bizId));
}

export async function getReferralsFor(userId: string) {
  const rows = await db
    .select()
    .from(referrals)
    .where(eq(referrals.inviterId, userId))
    .orderBy(desc(referrals.createdAt));
  return rows;
}

export async function getPlanForBusiness(bizId: string) {
  const { marketingPlans, marketingPlanDays } = await import("@/db/schema");
  const plans = await db.select().from(marketingPlans).where(eq(marketingPlans.businessId, bizId)).limit(1);
  if (!plans[0]) return null;
  const days = await db
    .select()
    .from(marketingPlanDays)
    .where(eq(marketingPlanDays.planId, plans[0].id))
    .orderBy(marketingPlanDays.day);
  return { plan: plans[0], days };
}

export async function getAiContents(bizId: string) {
  const { aiContents } = await import("@/db/schema");
  return await db
    .select()
    .from(aiContents)
    .where(eq(aiContents.businessId, bizId))
    .orderBy(desc(aiContents.createdAt));
}

export async function recordEvent(
  kind: string,
  businessId?: string | null,
  campaignId?: string | null,
  userId?: string | null,
  meta: Record<string, unknown> = {}
) {
  await db.insert(analyticsEvents).values({
    kind,
    businessId: businessId ?? null,
    campaignId: campaignId ?? null,
    userId: userId ?? null,
    meta,
  });
}

export async function getBusinessesByIds(ids: string[]) {
  if (!ids.length) return [];
  return await db.select().from(businesses).where(inArray(businesses.id, ids));
}

export async function getBusinessStaff(bizId: string) {
  return await db.select().from(businessStaff).where(and(eq(businessStaff.businessId, bizId)));
}

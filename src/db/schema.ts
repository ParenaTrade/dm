import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * DampingVar — veri modeli
 * Tüm parasal değerler integer "cents" (kuruş) olarak tutulur.
 * Oranlar doublePrecision (0-1 arası veya yüzde, kolon adında belirtilir).
 * ------------------------------------------------------------------ */

// 1. İşletmeler (Damping Noktaları)
export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(), // restoran | market | magaza | hizmet | yapi
    subCategory: text("sub_category"),
    sectorKey: text("sector_key").notNull().default("magaza"),
    district: text("district").notNull(),
    city: text("city").notNull().default("İstanbul"),
    address: text("address").notNull(),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    website: text("website"),
    instagram: text("instagram"),
    description: text("description"),
    story: text("story"),
    logoText: text("logo_text"),
    coverImage: text("cover_image"),
    planCode: text("plan_code").notNull().default("FREE"), // FREE | PRO | BOOST
    rating: doublePrecision("rating").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    verified: boolean("verified").notNull().default(false),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("businesses_category_idx").on(t.category, t.district)]
);

// 2. Çalışma saatleri
export const businessHours = pgTable("business_hours", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Pazar
  opensAt: text("opens_at").notNull().default("09:00"),
  closesAt: text("closes_at").notNull().default("22:00"),
  closed: boolean("closed").notNull().default(false),
});

// 3. Personel / roller
export const businessStaff = pgTable("business_staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  userKey: text("user_key").notNull(), // oturum kimliği (V1: e-posta tabanlı)
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("CASHIER"), // OWNER | MANAGER | CASHIER
  active: boolean("active").notNull().default(true),
});

// 4. Sözleşme / komisyon kuralları (kasiyer değiştiremez)
export const businessContracts = pgTable("business_contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  commissionRate: doublePrecision("commission_rate").notNull().default(0.06),
  commissionBase: text("commission_base").notNull().default("AFTER_DAMPING"), // GROSS | NET_AFTER_DISCOUNT | AFTER_DAMPING
  fixedFeeCents: integer("fixed_fee_cents").notNull().default(0),
  perCustomerFeeCents: integer("per_customer_fee_cents").notNull().default(0),
  referralRate: doublePrecision("referral_rate").notNull().default(0.01),
  poolContributionRate: doublePrecision("pool_contribution_rate").notNull().default(0.03),
  dampingRewardRate: doublePrecision("damping_reward_rate").notNull().default(0.02),
  packageCode: text("package_code").notNull().default("PRO"),
  active: boolean("active").notNull().default(true),
});

// 5. Ürünler
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  discountPriceCents: integer("discount_price_cents"),
  category: text("category"),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
});

// 6. Hizmetler
export const services = pgTable("business_services", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  durationMin: integer("duration_min"),
  active: boolean("active").notNull().default(true),
});

// 7. Medya
export const businessMedia = pgTable("business_media", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("IMAGE"), // IMAGE | VIDEO
  url: text("url"),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// 8. Yorumlar
export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 9. Müşteriler
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    district: text("district"),
    referralCode: text("referral_code").notNull().unique(),
    referredBy: uuid("referred_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("users_referral_idx").on(t.referralCode)]
);

// 10. Kampanyalar
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(), // QR / kasa kodu kökü
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").notNull().default("PERCENT"), // PERCENT|FIXED|PRODUCT|HOUR|DAY|FIRST|RETURN|QR_ONLY
    discountPercent: doublePrecision("discount_percent").notNull().default(0),
    discountAmountCents: integer("discount_amount_cents").notNull().default(0),
    minBasketCents: integer("min_basket_cents").notNull().default(0),
    maxDiscountCents: integer("max_discount_cents").notNull().default(0),
    usageLimit: integer("usage_limit"),
    perCustomerLimit: integer("per_customer_limit").notNull().default(1),
    startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    timeStart: text("time_start"),
    timeEnd: text("time_end"),
    days: jsonb("days").$type<number[]>().default([]),
    status: text("status").notNull().default("PUBLISHED"), // DRAFT | PUBLISHED | ENDED
    qrEnabled: boolean("qr_enabled").notNull().default(true),
    views: integer("views").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    redemptions: integer("redemptions").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("campaigns_business_idx").on(t.businessId)]
);

// 11. QR kodları
export const qrCodes = pgTable(
  "qr_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    customerId: uuid("customer_id").references(() => users.id),
    status: text("status").notNull().default("ACTIVE"), // ACTIVE | REDEEMED | EXPIRED | CANCELLED
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    transactionId: uuid("transaction_id"),
  },
  (t) => [index("qr_codes_customer_idx").on(t.customerId)]
);

// 12. Damping Hane cüzdanı
export const dampingWallets = pgTable("damping_wallets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  availableCents: integer("available_cents").notNull().default(0),
  pendingCents: integer("pending_cents").notNull().default(0),
  reservedCents: integer("reserved_cents").notNull().default(0),
  lifetimeEarnedCents: integer("lifetime_earned_cents").notNull().default(0),
  lifetimeSpentCents: integer("lifetime_spent_cents").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 13. Cüzdan defteri (ledger) — bakiye asla düz +x ile oynatılmaz
export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => dampingWallets.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    entryType: text("entry_type").notNull(), // EARN | SPEND | EXPIRE | REVERSE | REFERRAL
    status: text("status").notNull(), // PENDING|AVAILABLE|RESERVED|SPENT|EXPIRED|CANCELLED|FRAUD_REVIEW
    amountCents: integer("amount_cents").notNull(), // + kazanç / - harcama
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("wallet_ledger_wallet_idx").on(t.walletId)]
);

// 14. Ortak indirim havuzu
export const dampingPool = pgTable("damping_pool", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique().default("GLOBAL"),
  balanceCents: integer("balance_cents").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const poolLedger = pgTable(
  "pool_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id").references(() => businesses.id),
    direction: text("direction").notNull(), // CONTRIBUTE | CONSUME | REVERSE
    amountCents: integer("amount_cents").notNull(),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("pool_ledger_business_idx").on(t.businessId)]
);

// 15. Satış işlemleri
export const transactions = pgTable(
  "store_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    customerId: uuid("customer_id").references(() => users.id),
    cashierId: uuid("cashier_id").references(() => businessStaff.id),
    qrCodeId: uuid("qr_code_id").references(() => qrCodes.id),
    receiptNo: text("receipt_no").notNull().unique(),
    grossAmountCents: integer("gross_amount_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    dampingUsedCents: integer("damping_used_cents").notNull().default(0),
    netAmountCents: integer("net_amount_cents").notNull(),
    commissionBaseCents: integer("commission_base_cents").notNull().default(0),
    commissionRate: doublePrecision("commission_rate").notNull().default(0),
    commissionCents: integer("commission_cents").notNull().default(0),
    poolContributionCents: integer("pool_contribution_cents").notNull().default(0),
    dampingEarnedCents: integer("damping_earned_cents").notNull().default(0),
    status: text("status").notNull().default("COMPLETED"), // COMPLETED|REVERSED|FRAUD_REVIEW|CANCELLED
    paymentMethod: text("payment_method").notNull().default("NAKIT"),
    reversalOf: uuid("reversal_of"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("store_transactions_business_idx").on(t.businessId),
    index("store_transactions_customer_idx").on(t.customerId),
    index("store_transactions_created_idx").on(t.createdAt),
  ]
);

// 16. Referral
export const referrals = pgTable("referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  inviterId: uuid("inviter_id").notNull(),
  inviteeId: uuid("invitee_id").notNull(),
  code: text("code").notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING | QUALIFIED | REJECTED | FRAUD_REVIEW
  fraudFlags: jsonb("fraud_flags").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const referralRewards = pgTable("referral_rewards", {
  id: uuid("id").defaultRandom().primaryKey(),
  referralId: uuid("referral_id")
    .notNull()
    .references(() => referrals.id, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id").references(() => transactions.id),
  inviterId: uuid("inviter_id").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  status: text("status").notNull().default("PENDING"), // PENDING|AVAILABLE|PAID|CANCELLED|FRAUD_REVIEW
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 17. AI pazarlama planı
export const marketingPlans = pgTable("marketing_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  sectorKey: text("sector_key").notNull(),
  status: text("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const marketingPlanDays = pgTable(
  "marketing_plan_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => marketingPlans.id, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    theme: text("theme").notNull(),
    task: text("task").notNull(),
    channel: text("channel").notNull(),
    caption: text("caption"),
    cta: text("cta"),
    done: boolean("done").notNull().default(false),
  },
  (t) => [index("marketing_plan_days_plan_idx").on(t.planId)]
);

// 18. AI içerikleri (onay akışı)
export const aiContents = pgTable(
  "ai_contents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // SOCIAL | AD | VIDEO | STORY | CAMPAIGN | PRODUCT | LOCAL | REPORT
    platform: text("platform"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    cta: text("cta"),
    variant: text("variant"),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    status: text("status").notNull().default("DRAFT"), // DRAFT|APPROVED|PUBLISHED|REJECTED
    createdBy: text("created_by").notNull().default("AI"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [index("ai_contents_business_idx").on(t.businessId)]
);

// 19. Reklam
export const adCampaigns = pgTable("ad_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  placement: text("placement").notNull().default("ANASAYFA"),
  city: text("city"),
  district: text("district"),
  category: text("category"),
  budgetCents: integer("budget_cents").notNull().default(0),
  status: text("status").notNull().default("DRAFT"), // DRAFT|PENDING_APPROVAL|ACTIVE|ENDED
  startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
});

export const adEvents = pgTable("ad_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  adId: uuid("ad_id")
    .notNull()
    .references(() => adCampaigns.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // IMPRESSION | CLICK
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 20. Analytics olayları
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id").references(() => businesses.id),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    userId: uuid("user_id").references(() => users.id),
    kind: text("kind").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("analytics_events_business_idx").on(t.businessId, t.kind)]
);

// 21. Paketler (fiyatlar admin panelinden yönetilir, koda gömülmez)
export const packages = pgTable("packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  priceMonthlyCents: integer("price_monthly_cents").notNull().default(0),
  features: jsonb("features").$type<string[]>().default([]),
  aiQuotaMonthly: integer("ai_quota_monthly").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

// 22. Admin: AI kullanım ayarları
export const aiSettings = pgTable("ai_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
});

// 23. Fraud incelemesi
export const fraudReviews = pgTable("fraud_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").references(() => transactions.id),
  userId: uuid("user_id"),
  reason: text("reason").notNull(),
  signals: jsonb("signals").$type<string[]>().default([]),
  status: text("status").notNull().default("OPEN"), // OPEN | CLEARED | BLOCKED
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 24. Audit log
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actor: text("actor").notNull(),
  role: text("role").notNull().default("SYSTEM"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 25. Mahsup / hakediş
export const settlements = pgTable("settlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  grossSalesCents: integer("gross_sales_cents").notNull().default(0),
  discountCents: integer("discount_cents").notNull().default(0),
  dampingUsedCents: integer("damping_used_cents").notNull().default(0),
  netSalesCents: integer("net_sales_cents").notNull().default(0),
  commissionCents: integer("commission_cents").notNull().default(0),
  poolContributionCents: integer("pool_contribution_cents").notNull().default(0),
  poolConsumedCents: integer("pool_consumed_cents").notNull().default(0),
  netPositionCents: integer("net_position_cents").notNull().default(0),
  status: text("status").notNull().default("CALCULATED"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

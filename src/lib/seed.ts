import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  businessHours,
  businessStaff,
  businessContracts,
  products,
  services,
  businessMedia,
  reviews,
  users,
  campaigns,
  qrCodes,
  dampingWallets,
  walletLedger,
  dampingPool,
  poolLedger,
  transactions,
  referrals,
  referralRewards,
  marketingPlans,
  marketingPlanDays,
  aiContents,
  adCampaigns,
  analyticsEvents,
  packages,
  aiSettings,
  auditLogs,
} from "@/db/schema";
import { buildMarketingPlan, type BusinessSnapshot, type SectorKey } from "@/lib/ai";

type SeedBusiness = {
  slug: string;
  name: string;
  category: string;
  subCategory: string;
  sectorKey: SectorKey;
  district: string;
  address: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  website: string;
  description: string;
  story: string;
  logoText: string;
  coverImage: string;
  rating: number;
  reviewCount: number;
  planCode: string;
  featured: boolean;
  hours: [string, string] | null; // null = kapalı
  products: { name: string; description: string; priceCents: number; discountPriceCents?: number }[];
  services?: { name: string; description: string; priceCents: number; durationMin?: number }[];
  campaign: {
    code: string;
    title: string;
    description: string;
    type: string;
    discountPercent: number;
    minBasketCents: number;
    maxDiscountCents: number;
    timeStart?: string;
    timeEnd?: string;
    days?: number[];
  };
  reviews: { authorName: string; rating: number; comment: string }[];
};

const SEED: SeedBusiness[] = [
  {
    slug: "kadikoy-pizza-atolyesi",
    name: "Kadıköy Pizza Atölyesi",
    category: "restoran",
    subCategory: "Pizza & İtalyan",
    sectorKey: "restoran",
    district: "Kadıköy",
    address: "Caferağa Mah. Moda Cad. No:74, Kadıköy / İstanbul",
    phone: "0216 348 12 34",
    whatsapp: "905321110034",
    instagram: "kadikoypizzaatolyesi",
    website: "kadikoypizzaatolyesi.com",
    description:
      "Taş fırında 48 saat mayalanmış hamur, günlük taze mozzarella ve yerel üreticiden gelen malzemelerle Moda'da pizza.",
    story:
      "2016'da Moda'da küçük bir dükkânda, tek bir taş fırınla başladık. Hamurumuz 48 saat mayalanır, sosumuz her sabah taze çekilir. Bugün de aynı fırın, aynı tarif.",
    logoText: "KPA",
    coverImage: "images/restoran.jpg",
    rating: 4.7,
    reviewCount: 312,
    planCode: "BOOST",
    featured: true,
    hours: ["11:30", "23:30"],
    products: [
      { name: "Pizza Atölyesi Special", description: "Sucuk, mantar, taze kekik, mozzarella", priceCents: 40000, discountPriceCents: 34000 },
      { name: "Margherita Classica", description: "Domates sosu, mozzarella, fesleğen", priceCents: 32000, discountPriceCents: 27200 },
      { name: "Truffle & Mantarlı Pizza", description: "Kestane mantarı, trüf yağı, parmesan", priceCents: 48000, discountPriceCents: 40800 },
    ],
    services: [{ name: "Grup Rezervasyonu", description: "10 kişi ve üzeri masa düzeni", priceCents: 0, durationMin: 120 }],
    campaign: {
      code: "KPA-DAMP-15",
      title: "Bugünün Dampingi: %15 Pizza Avantajı",
      description:
        "DampingVar QR'ı ile gelen müşterilere tüm pizzalarda %15 damping. Minimum sepet 250 TL, kişi başı 1 kullanım. Kampanya her gün, tüm saatlerde geçerlidir.",
      type: "PERCENT",
      discountPercent: 15,
      minBasketCents: 25000,
      maxDiscountCents: 12000,
    },
    reviews: [
      { authorName: "Elif Y.", rating: 5, comment: "Hamuru inanılmaz. DampingVar QR'ını gösterdim, indirim kasada anında uygulandı." },
      { authorName: "Mert K.", rating: 5, comment: "Moda'da gidilebilecek en dürüst pizza yeri. Fiyat/performans çok iyi." },
      { authorName: "Selin A.", rating: 4, comment: "Akşam saatleri kalabalık oluyor, rezervasyon şart." },
    ],
  },
  {
    slug: "moda-kahve",
    name: "Moda Kahve Kavurma Atölyesi",
    category: "restoran",
    subCategory: "Kahve & Tatlı",
    sectorKey: "restoran",
    district: "Kadıköy",
    address: "Caferağa Mah. Dr. Esat Işık Cad. No:12, Kadıköy / İstanbul",
    phone: "0216 337 55 21",
    whatsapp: "905321110021",
    instagram: "modakahve",
    website: "modakahve.co",
    description: "Kendi kavurduğumuz çekirdekler, günlük hazırlanan tatlılar ve Moda'ya bakan küçük bir teras.",
    story: "Kavurma makinemizi 2019'da dükkânın arkasına kurduk. O gün bugündür her hafta iki kez kavuruyoruz.",
    logoText: "MK",
    coverImage: "images/restoran.jpg",
    rating: 4.6,
    reviewCount: 198,
    planCode: "PRO",
    featured: true,
    hours: ["08:00", "22:00"],
    products: [
      { name: "Filtre Kahve (V60)", description: "Etiyopya Yirgacheffe, orta kavurma", priceCents: 12000, discountPriceCents: 9600 },
      { name: "San Sebastián Cheesecake", description: "Günlük hazırlanan, sınırlı sayıda", priceCents: 16500, discountPriceCents: 14000 },
      { name: "Flat White", description: "Çift shot, tam yağlı süt", priceCents: 13500 },
    ],
    campaign: {
      code: "MK-SABAH-20",
      title: "Sabah 08:00–10:00 Kahve Dampingi",
      description: "Sabah saatlerinde filtre kahve + tatlı ikilisinde %20 damping avantajı.",
      type: "HOUR",
      discountPercent: 20,
      minBasketCents: 20000,
      maxDiscountCents: 10000,
      timeStart: "08:00",
      timeEnd: "10:00",
    },
    reviews: [
      { authorName: "Deniz T.", rating: 5, comment: "Kahve gerçekten taze kavrulmuş, fark ediliyor." },
      { authorName: "Burak S.", rating: 4, comment: "Teras küçük ama çok keyifli." },
    ],
  },
  {
    slug: "bogazici-yapi-market",
    name: "Boğaziçi Yapı Market",
    category: "yapi",
    subCategory: "Yapı Market & Hırdavat",
    sectorKey: "yapi",
    district: "Beyoğlu",
    address: "Kaptanpaşa Mah. Piyalepaşa Bulvarı No:210, Beyoğlu / İstanbul",
    phone: "0212 234 78 90",
    whatsapp: "905321110090",
    instagram: "bogaziciyapi",
    website: "bogaziciyapi.com.tr",
    description: "Boya, nalbur, elektrik, tesisat ve tadilat malzemelerinde 22 yıllık tedarik ve ustaya özel fiyat.",
    story: "1998'de bir nalburduk. Bugün 4.500 kalem ürün, 12 kişilik ekip ve aynı mahalledeyiz.",
    logoText: "BYM",
    coverImage: "images/magaza-ic.jpg",
    rating: 4.5,
    reviewCount: 421,
    planCode: "BOOST",
    featured: true,
    hours: ["08:30", "19:30"],
    products: [
      { name: "Silikonlu İç Cephe Boyası 15 L", description: "Yıkanabilir, mat", priceCents: 289000, discountPriceCents: 245000 },
      { name: "Akülü Vidalama Seti", description: "2 akü, 40 parça aksesuar", priceCents: 349000, discountPriceCents: 299000 },
      { name: "LED Panel Armatür 40W", description: "Gün ışığı, 5 yıl garanti", priceCents: 89000, discountPriceCents: 75000 },
    ],
    services: [
      { name: "Usta Yönlendirme", description: "Anlaşmalı ustalarımızla keşif", priceCents: 0, durationMin: 60 },
      { name: "Renk Karışım Servisi", description: "15 dk'da özel renk", priceCents: 4500, durationMin: 15 },
    ],
    campaign: {
      code: "BYM-PROJE-10",
      title: "Proje Sepetine %10 Damping",
      description: "1.500 TL üzeri tadilat sepetlerinde %10 damping. Usta kartı olanlara ek %2.",
      type: "PERCENT",
      discountPercent: 10,
      minBasketCents: 150000,
      maxDiscountCents: 75000,
    },
    reviews: [
      { authorName: "Ahmet U.", rating: 5, comment: "Usta olarak 10 yıldır buradan alıyorum. Fiyat net, stok ciddi." },
      { authorName: "Nihal Ç.", rating: 4, comment: "Renk karışım servisi çok pratik." },
    ],
  },
  {
    slug: "nistantasi-kuafor",
    name: "Nişantaşı Saç Tasarım",
    category: "hizmet",
    subCategory: "Kuaför & Güzellik",
    sectorKey: "hizmet",
    district: "Şişli",
    address: "Teşvikiye Mah. Abdi İpekçi Cad. No:31, Şişli / İstanbul",
    phone: "0212 241 60 12",
    whatsapp: "905321110012",
    instagram: "nistantasisactasarim",
    website: "nistantasisactasarim.com",
    description: "Kesim, renklendirme ve bakım; randevulu çalışan, üç kişilik butik ekip.",
    story: "Her saçın bir hikâyesi var. Biz önce dinliyoruz, sonra makası alıyoruz.",
    logoText: "NST",
    coverImage: "images/magaza-ic.jpg",
    rating: 4.8,
    reviewCount: 156,
    planCode: "PRO",
    featured: false,
    hours: ["10:00", "20:00"],
    products: [],
    services: [
      { name: "Saç Kesimi + Şekillendirme", description: "Danışmanlık dahil", priceCents: 18000, durationMin: 60 },
      { name: "Balyaj & Bakım", description: "Olaplex bakım dahil", priceCents: 65000, durationMin: 180 },
      { name: "Saç Bakım Ritüeli", description: "Keratin destekli bakım", priceCents: 32000, durationMin: 90 },
    ],
    campaign: {
      code: "NST-ILK-25",
      title: "İlk Ziyarete %25 Damping",
      description: "DampingVar üzerinden gelen yeni müşterilerin ilk hizmetinde %25 damping. Randevu zorunlu.",
      type: "FIRST",
      discountPercent: 25,
      minBasketCents: 15000,
      maxDiscountCents: 25000,
    },
    reviews: [
      { authorName: "Ceren B.", rating: 5, comment: "Balyaj sonucu tam istediğim gibi oldu. Randevu sistemi de çok düzenli." },
      { authorName: "Aslı G.", rating: 5, comment: "DampingVar'dan gittim, %25 indirim kasada uygulandı." },
    ],
  },
  {
    slug: "bostanci-semt-market",
    name: "Bostancı Semt Market",
    category: "market",
    subCategory: "Market & Bakkal",
    sectorKey: "market",
    district: "Kadıköy",
    address: "Bostancı Mah. Bağdat Cad. No:412, Kadıköy / İstanbul",
    phone: "0216 382 44 55",
    whatsapp: "905321110055",
    instagram: "bostancisemtmarket",
    website: "",
    description: "Günlük taze meyve-sebze, şarküteri ve temel gıda; mahallenin 24 yıllık marketi.",
    story: "Sabah 06:00'da halden gelen sebzeler, akşamüstü mahallenin sofrasında.",
    logoText: "BSM",
    coverImage: "images/magaza-ic.jpg",
    rating: 4.4,
    reviewCount: 267,
    planCode: "PRO",
    featured: false,
    hours: ["07:30", "23:00"],
    products: [
      { name: "Kahvaltılık Paketi", description: "Peynir, zeytin, bal, reçel, tereyağı", priceCents: 89900, discountPriceCents: 76400 },
      { name: "Günlük Süt 1 L", description: "Yerel üretici, günlük", priceCents: 3200 },
      { name: "Sebze Sepeti", description: "Mevsim sebzeleri, 5 kg", priceCents: 45000, discountPriceCents: 38200 },
    ],
    campaign: {
      code: "BSM-HAFTA-12",
      title: "Hafta İçi 14:00–17:00 Sepet Dampingi",
      description: "Öğleden sonra saatlerinde 400 TL üzeri sepetlerde %12 damping.",
      type: "HOUR",
      discountPercent: 12,
      minBasketCents: 40000,
      maxDiscountCents: 30000,
      timeStart: "14:00",
      timeEnd: "17:00",
      days: [1, 2, 3, 4, 5],
    },
    reviews: [
      { authorName: "Hakan Ö.", rating: 4, comment: "Sebze gerçekten taze, fiyatlar makul." },
      { authorName: "Gülay M.", rating: 5, comment: "Mahallenin en güvenilir marketi." },
    ],
  },
  {
    slug: "karakoy-lokantasi",
    name: "Karaköy Lokantası",
    category: "restoran",
    subCategory: "Ev Yemeği & Meyhane",
    sectorKey: "restoran",
    district: "Beyoğlu",
    address: "Kemankeş Cad. No:11, Beyoğlu / İstanbul",
    phone: "0212 292 44 11",
    whatsapp: "905321110011",
    instagram: "karakoylokantasi",
    website: "karakoylokantasi.com",
    description: "Günlük ev yemekleri, zeytinyağlılar ve meyhane sofrası; 1954'ten beri Karaköy'de.",
    story: "Üç kuşaktır aynı mutfakta, her sabah aynı tencereler kaynıyor.",
    logoText: "KKL",
    coverImage: "images/restoran.jpg",
    rating: 4.6,
    reviewCount: 508,
    planCode: "FREE",
    featured: false,
    hours: ["11:00", "23:00"],
    products: [
      { name: "Günün Tabağı", description: "3 çeşit ev yemeği + pilav + ayran", priceCents: 22000, discountPriceCents: 18700 },
      { name: "Zeytinyağlı Seçmece", description: "5 çeşit meze tabağı", priceCents: 26000, discountPriceCents: 22100 },
    ],
    campaign: {
      code: "KKL-OGLE-15",
      title: "Öğle Molasında %15 Damping",
      description: "12:00–15:00 arası günün tabağında %15 damping.",
      type: "PERCENT",
      discountPercent: 15,
      minBasketCents: 15000,
      maxDiscountCents: 8000,
      timeStart: "12:00",
      timeEnd: "15:00",
    },
    reviews: [
      { authorName: "Yusuf D.", rating: 5, comment: "Anneanne yemeği gibi. Öğle dampingi de çok iyi düşünülmüş." },
      { authorName: "Pelin E.", rating: 4, comment: "Mezeler taze, servis hızlı." },
    ],
  },
];

const CUSTOMERS = [
  { name: "Ahmet Yılmaz", email: "ahmet.yilmaz@example.com", phone: "05321110001", referralCode: "AHMET728", district: "Kadıköy" },
  { name: "Mehmet Demir", email: "mehmet.demir@example.com", phone: "05321110002", referralCode: "MEHMET441", district: "Kadıköy" },
  { name: "Zeynep Kaya", email: "zeynep.kaya@example.com", phone: "05321110003", referralCode: "ZEYNEP913", district: "Şişli" },
  { name: "Ayşe Çelik", email: "ayse.celik@example.com", phone: "05321110004", referralCode: "AYSE205", district: "Beyoğlu" },
];

export async function ensureSeed(): Promise<void> {
  const existing = await db.execute(sql`select count(*)::int as n from businesses`);
  if (Number((existing.rows ?? [])[0]?.n ?? 0) > 0) return;

  /* Paketler — fiyatlar koda gömülü değil, admin panelinden yönetilir */
  await db.insert(packages).values([
    { code: "FREE", name: "Free", priceMonthlyCents: 0, aiQuotaMonthly: 0, features: ["İşletme sayfası", "Temel profil", "2 kampanya", "Temel görünürlük"] },
    { code: "PRO", name: "Pro", priceMonthlyCents: 249000, aiQuotaMonthly: 120, features: ["AI pazarlama", "28 günlük plan", "Sınırsız kampanya", "İçerik üretimi", "Performans analizi", "QR kampanyaları"] },
    { code: "BOOST", name: "Boost", priceMonthlyCents: 699000, aiQuotaMonthly: 400, features: ["Bölgesel görünürlük", "Öne çıkarma", "Reklam kampanyaları", "AI optimizasyonu", "Gelişmiş analiz"] },
  ]);

  await db.insert(aiSettings).values([
    { key: "ai_provider", value: "local-template-engine", description: "AI içerik sağlayıcısı (V1: yerel şablon motoru)" },
    { key: "ai_model", value: "dampingvar-marketing-v1", description: "Kullanılan model" },
    { key: "ai_api_key", value: "server-side-only", description: "API anahtarı yalnızca sunucu tarafında tutulur, frontend'e sızmaz" },
    { key: "ai_monthly_budget_cents", value: "250000", description: "Aylık AI maliyet bütçesi (kuruş)" },
    { key: "ai_content_limit_per_business", value: "60", description: "İşletme başına aylık içerik üretim limiti" },
  ]);

  await db.insert(dampingPool).values({ key: "GLOBAL", balanceCents: 0 });

  const staff: { id: string; businessSlug: string }[] = [];

  for (const b of SEED) {
    const [biz] = await db
      .insert(businesses)
      .values({
        slug: b.slug,
        name: b.name,
        category: b.category,
        subCategory: b.subCategory,
        sectorKey: b.sectorKey,
        district: b.district,
        city: "İstanbul",
        address: b.address,
        phone: b.phone,
        whatsapp: b.whatsapp,
        instagram: b.instagram,
        website: b.website,
        description: b.description,
        story: b.story,
        logoText: b.logoText,
        coverImage: b.coverImage,
        rating: b.rating,
        reviewCount: b.reviewCount,
        planCode: b.planCode,
        verified: true,
        featured: b.featured,
      })
      .returning();

    for (let d = 0; d < 7; d++) {
      await db.insert(businessHours).values({
        businessId: biz.id,
        dayOfWeek: d,
        opensAt: b.hours?.[0] ?? "09:00",
        closesAt: b.hours?.[1] ?? "22:00",
        closed: d === 0 && b.sectorKey === "yapi",
      });
    }

    await db.insert(businessContracts).values({
      businessId: biz.id,
      commissionRate: b.planCode === "BOOST" ? 0.045 : b.planCode === "PRO" ? 0.06 : 0.08,
      commissionBase: "AFTER_DAMPING",
      referralRate: 0.01,
      poolContributionRate: 0.03,
      dampingRewardRate: 0.02,
      packageCode: b.planCode,
    });

    const owner = await db
      .insert(businessStaff)
      .values({
        businessId: biz.id,
        userKey: `${b.slug}-owner`,
        name: `${b.name} Sahibi`,
        email: `sahip@${b.slug}.com`,
        role: "OWNER",
      })
      .returning();
    const cashier = await db
      .insert(businessStaff)
      .values({
        businessId: biz.id,
        userKey: `${b.slug}-kasiyer`,
        name: "Kasiyer",
        email: `kasiyer@${b.slug}.com`,
        role: "CASHIER",
      })
      .returning();
    staff.push({ id: cashier[0].id, businessSlug: b.slug });

    for (const p of b.products) {
      await db.insert(products).values({
        businessId: biz.id,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        discountPriceCents: p.discountPriceCents ?? null,
      });
    }
    for (const s of b.services ?? []) {
      await db.insert(services).values({
        businessId: biz.id,
        name: s.name,
        description: s.description,
        priceCents: s.priceCents,
        durationMin: s.durationMin ?? null,
      });
    }

    await db.insert(businessMedia).values([
      { businessId: biz.id, kind: "IMAGE", url: b.coverImage, caption: `${b.name} — ${b.district}`, sortOrder: 0 },
      { businessId: biz.id, kind: "IMAGE", url: "images/magaza-ic.jpg", caption: "İşletme içi", sortOrder: 1 },
      { businessId: biz.id, kind: "IMAGE", url: "images/restoran.jpg", caption: "Öne çıkan", sortOrder: 2 },
    ]);

    for (const r of b.reviews) {
      await db.insert(reviews).values({ businessId: biz.id, authorName: r.authorName, rating: r.rating, comment: r.comment });
    }

    const [camp] = await db
      .insert(campaigns)
      .values({
        businessId: biz.id,
        code: b.campaign.code,
        title: b.campaign.title,
        description: b.campaign.description,
        type: b.campaign.type,
        discountPercent: b.campaign.discountPercent,
        minBasketCents: b.campaign.minBasketCents,
        maxDiscountCents: b.campaign.maxDiscountCents,
        timeStart: b.campaign.timeStart ?? null,
        timeEnd: b.campaign.timeEnd ?? null,
        days: b.campaign.days ?? [],
        status: "PUBLISHED",
        qrEnabled: true,
      })
      .returning();

    await db.update(campaigns).set({ views: 600 + Math.round(Math.random() * 3000), clicks: 120 + Math.round(Math.random() * 600) }).where(eq(campaigns.id, camp.id));

    /* Analitik olayları (gerçekçi dağılım) */
    for (let i = 0; i < 24; i++) {
      await db.insert(analyticsEvents).values({
        businessId: biz.id,
        campaignId: camp.id,
        kind: "campaign_view",
        meta: { hour: i, source: "anasayfa" },
      });
    }

    /* AI içerik taslakları + 28 günlük plan */
    const snapshot: BusinessSnapshot = {
      name: biz.name,
      sectorKey: b.sectorKey,
      category: b.category,
      district: b.district,
      city: "İstanbul",
      description: b.description,
      rating: b.rating,
      reviewCount: b.reviewCount,
      products: b.products.map((p) => ({ name: p.name, priceCents: p.priceCents, discountPriceCents: p.discountPriceCents ?? null })),
      services: (b.services ?? []).map((s) => ({ name: s.name, priceCents: s.priceCents })),
      campaigns: [{ title: b.campaign.title, type: b.campaign.type, discountPercent: b.campaign.discountPercent, discountAmountCents: 0 }],
      stats: {
        pageViews: 2840,
        campaignViews: 940,
        qrGenerated: 210,
        qrRedeemed: 94,
        transactionCount: 94,
        revenueCents: 3850000,
        avgBasketCents: 40900,
        newCustomers: 41,
        repeatRate: 0.32,
        hourHistogram: [2, 3, 4, 6, 9, 14, 22, 31, 27, 21, 18, 19, 26, 34, 29, 22, 19, 24, 38, 44, 41, 33, 21, 9],
        dayHistogram: [22, 26, 34, 29, 31, 46, 42],
      },
    };

    const plan = await db
      .insert(marketingPlans)
      .values({
        businessId: biz.id,
        title: `28 Günlük DampingVar Pazarlama Planı — ${b.district}`,
        goal: "Bu hafta müşteri sayısını artırmak istiyorum.",
        sectorKey: b.sectorKey,
        status: "ACTIVE",
      })
      .returning();
    for (const day of buildMarketingPlan(snapshot)) {
      await db.insert(marketingPlanDays).values({
        planId: plan[0].id,
        day: day.day,
        theme: day.theme,
        task: day.task,
        channel: day.channel,
        caption: `${day.theme} — ${b.name}, ${b.district}`,
        cta: day.cta,
        done: day.day <= 3,
      });
    }

    await db.insert(aiContents).values([
      {
        businessId: biz.id,
        kind: "SOCIAL",
        platform: "Instagram",
        title: `${b.district}'de ${b.products[0]?.name ?? b.subCategory}`,
        body: `${b.name}, ${b.district}'de sizi bekliyor.\n\n${b.description}\n\nAktif damping: ${b.campaign.title}\n\n#${b.district.toLocaleLowerCase("tr-TR").replace(/\s/g, "")} #dampingvar`,
        cta: "Alışveriş yapmadan önce DampingVar'a bak.",
        status: "DRAFT",
      },
      {
        businessId: biz.id,
        kind: "AD",
        platform: "DampingVar Reklam Ağı",
        title: "Fiyat odaklı reklam varyasyonu (A)",
        body: `${b.name} — ${b.campaign.title}. ${b.district}, İstanbul.`,
        cta: "Kampanyayı incele",
        variant: "A",
        status: "DRAFT",
      },
      {
        businessId: biz.id,
        kind: "VIDEO",
        platform: "Instagram Reels",
        title: `${b.name} — 15 saniyelik damping videosu`,
        body: `0–3 sn: ${b.district} sokak görünümü\n3–7 sn: ${b.products[0]?.name ?? "öne çıkan"} yakın çekim\n7–11 sn: fiyat kartı\n11–15 sn: QR kasa görüntüsü`,
        cta: "Kasada QR'ını göster.",
        status: "APPROVED",
        meta: { durationSec: 15 },
      },
    ]);

    await db.insert(adCampaigns).values({
      businessId: biz.id,
      name: `${b.district} bölgesel görünürlük`,
      placement: b.planCode === "BOOST" ? "ANASAYFA" : "KATEGORI",
      city: "İstanbul",
      district: b.district,
      category: b.category,
      budgetCents: b.planCode === "BOOST" ? 2500000 : 0,
      status: b.planCode === "BOOST" ? "ACTIVE" : "DRAFT",
      impressions: 12000 + Math.round(Math.random() * 8000),
      clicks: 400 + Math.round(Math.random() * 300),
    });

    await db.insert(auditLogs).values({
      actor: "system@dampingvar.com",
      role: "SYSTEM",
      action: "BUSINESS_SEEDED",
      entityType: "businesses",
      entityId: biz.id,
      meta: { slug: b.slug, plan: b.planCode },
    });
  }

  /* Müşteriler + cüzdanlar */
  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const [u] = await db
      .insert(users)
      .values({
        name: c.name,
        email: c.email,
        phone: c.phone,
        district: c.district,
        referralCode: c.referralCode,
        referredBy: null,
      })
      .returning();
    customerIds.push(u.id);
    await db.insert(dampingWallets).values({ userId: u.id, availableCents: 0, pendingCents: 0, reservedCents: 0 });
  }

  // Mehmet'i Ahmet davet etti (tek seviye: A → B)
  await db.insert(referrals).values({
    inviterId: customerIds[0],
    inviteeId: customerIds[1],
    code: "AHMET728",
    status: "QUALIFIED",
    fraudFlags: [],
  });

  /* Geçmiş satışlar + ledger (mahsup raporu için gerçek veri) */
  const bizRows = await db.select().from(businesses);
  const contractRows = await db.select().from(businessContracts);
  const campaignRows = await db.select().from(campaigns);

  let receiptSeq = 1000;
  for (const biz of bizRows) {
    const contract = contractRows.find((c) => c.businessId === biz.id)!;
    const camp = campaignRows.find((c) => c.businessId === biz.id)!;
    for (let i = 0; i < 26; i++) {
      const gross = 12000 + Math.round(Math.random() * 68000);
      const discount = Math.round((gross * camp.discountPercent) / 100);
      const net = gross - discount;
      const base = Math.max(0, net);
      const commission = Math.round(base * contract.commissionRate);
      const poolContribution = Math.round(net * contract.poolContributionRate);
      const dampingEarned = Math.round(net * contract.dampingRewardRate);
      const customerId = customerIds[i % customerIds.length];
      const createdAt = new Date(Date.now() - (26 - i) * 11 * 3600 * 1000);
      const rno = `DMP-SEED-${receiptSeq++}`;

      const [txRow] = await db
        .insert(transactions)
        .values({
          businessId: biz.id,
          campaignId: camp.id,
          customerId,
          cashierId: staff.find((s) => s.businessSlug === biz.slug)?.id ?? null,
          receiptNo: rno,
          grossAmountCents: gross,
          discountCents: discount,
          dampingUsedCents: 0,
          netAmountCents: net,
          commissionBaseCents: base,
          commissionRate: contract.commissionRate,
          commissionCents: commission,
          poolContributionCents: poolContribution,
          dampingEarnedCents: dampingEarned,
          status: "COMPLETED",
          paymentMethod: i % 3 === 0 ? "KART" : "NAKIT",
          createdAt,
        })
        .returning();

      if (poolContribution > 0) {
        await db.insert(poolLedger).values({
          businessId: biz.id,
          direction: "CONTRIBUTE",
          amountCents: poolContribution,
          refType: "TRANSACTION",
          refId: txRow.id,
          description: `${biz.name} — havuz katkısı (${rno})`,
        });
      }
      if (dampingEarned > 0) {
        await db.insert(poolLedger).values({
          businessId: biz.id,
          direction: "CONSUME",
          amountCents: dampingEarned,
          refType: "TRANSACTION",
          refId: txRow.id,
          description: `${biz.name} — havuzdan karşılanan ödül (${rno})`,
        });
      }

      const wallet = (await db.select().from(dampingWallets).where(eq(dampingWallets.userId, customerId)))[0];
      if (wallet) {
        await db.insert(walletLedger).values({
          walletId: wallet.id,
          userId: customerId,
          entryType: "EARN",
          status: "AVAILABLE",
          amountCents: dampingEarned,
          refType: "TRANSACTION",
          refId: txRow.id,
          description: `${biz.name} — damping kazancı (${rno})`,
          createdAt,
        });
        await db
          .update(dampingWallets)
          .set({
            availableCents: wallet.availableCents + dampingEarned,
            lifetimeEarnedCents: wallet.lifetimeEarnedCents + dampingEarned,
          })
          .where(eq(dampingWallets.id, wallet.id));
      }
    }
  }

  // Havuz bakiyesini ledger'dan hesapla
  const poolSum = await db.execute(
    sql`select coalesce(sum(case when direction = 'CONTRIBUTE' then amount_cents when direction = 'CONSUME' then -amount_cents else amount_cents end), 0)::int as n from pool_ledger`
  );
  await db
    .update(dampingPool)
    .set({ balanceCents: Number((poolSum.rows ?? [])[0]?.n ?? 0) })
    .where(eq(dampingPool.key, "GLOBAL"));

  // Referral ödülü (Mehmet'in alışverişinden Ahmet'e)
  const firstTx = (await db.select().from(transactions).where(eq(transactions.customerId, customerIds[1])).limit(1))[0];
  if (firstTx) {
    await db.insert(referralRewards).values({
      referralId: (await db.select().from(referrals))[0].id,
      transactionId: firstTx.id,
      inviterId: customerIds[0],
      amountCents: 1000,
      status: "AVAILABLE",
    });
    const w = (await db.select().from(dampingWallets).where(eq(dampingWallets.userId, customerIds[0])))[0];
    if (w) {
      await db.insert(walletLedger).values({
        walletId: w.id,
        userId: customerIds[0],
        entryType: "REFERRAL",
        status: "AVAILABLE",
        amountCents: 1000,
        refType: "REFERRAL",
        description: "Paylaş & Kazan ödülü",
      });
      await db
        .update(dampingWallets)
        .set({ availableCents: w.availableCents + 1000, lifetimeEarnedCents: w.lifetimeEarnedCents + 1000 })
        .where(eq(dampingWallets.id, w.id));
    }
  }

  // Aktivasyon QR'ları
  for (const biz of bizRows) {
    const camp = campaignRows.find((c) => c.businessId === biz.id)!;
    for (let i = 0; i < 3; i++) {
      await db.insert(qrCodes).values({
        code: `QR-${biz.slug.slice(0, 6).toUpperCase()}-${1000 + i}`,
        businessId: biz.id,
        campaignId: camp.id,
        customerId: customerIds[i % customerIds.length],
        status: "ACTIVE",
      });
    }
  }
}

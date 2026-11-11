/**
 * İdempotent başlangıç verisi. İlk istekte bir kez çalışır (feature_flags boşsa).
 * Demo hesapları: cenkbey / admin123 (admin + yayıncı), izleyici / demo123 (seviye 3).
 */
import { db } from "@/db";
import {
  channels, chatMessages, chatRooms, featureFlags, predictions, profiles, promotions, quests,
  siteSettings, sponsorGames, sponsorGeoRules, sponsors, storeItems,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "./auth";
import { tournamentRollover } from "./platform";

const g = globalThis as typeof globalThis & { __seedPromise?: Promise<void> };

export function ensureSeed() {
  if (!g.__seedPromise) g.__seedPromise = run().catch((e) => { g.__seedPromise = undefined; console.error("[seed]", e); });
  return g.__seedPromise;
}

async function run() {
  const c = await db.execute<{ n: string }>(sql`select count(*)::int as n from feature_flags`);
  if (Number(c.rows[0]?.n) > 0) { await tournamentRollover(); return; }
  console.log("[seed] başlangıç verisi yükleniyor");
  const [admin] = await db.insert(profiles).values({
    username: "cenkbey", passwordHash: hashPassword("admin123"), role: "admin", level: 10, xp: 950,
    coinBalance: 10000, birthYear: 1992, ageConfirmedAt: new Date(),
  }).returning();
  await db.insert(profiles).values({
    username: "izleyici", passwordHash: hashPassword("demo123"), level: 3, xp: 220, coinBalance: 1000,
    birthYear: 1998, ageConfirmedAt: new Date(),
  });
  await db.insert(featureFlags).values([
    { key: "store_enabled", enabled: false },
    { key: "originals_enabled", enabled: true },
    { key: "predictions_enabled", enabled: true },
    { key: "sponsors_enabled", enabled: true },
  ]);
  await db.insert(siteSettings).values([
    { key: "about", value: "Cenkbey, 2018'den beri slot ve oyun yayınları yapan bir içerik üreticisi. Topluluğuyla birlikte eğlenceli, şeffaf ve sorumlu yayın anlayışını benimser. Her gün 20:00'da canlı yayında!" },
    { key: "pinned_site", value: "Hoş geldin! Coin'ler sanaldır, nakit değeri yoktur. Mesaj yazmak için 3. seviyeye ulaş." },
    { key: "support_url", value: "https://t.me/example" },
  ]);
  await db.insert(chatRooms).values({ room: "site", slowModeSeconds: 0, minLevel: 3 });
  const sp = await db.insert(sponsors).values([
    { name: "RedSpin", slug: "redspin", category: "casino", color: "#dc2626", description: "Yeni üyelere hoş geldin bonusu. 18+ | Sorumlu oyna.", affiliateUrl: "https://example.com/redspin", promoCode: "CENK", isFeatured: true, sortOrder: 1 },
    { name: "NovaPlay", slug: "novaplay", category: "casino", color: "#7c3aed", description: "Haftalık kayıp iadesi kampanyası. 18+", affiliateUrl: "https://example.com/novaplay", promoCode: "CENKBEY", isFeatured: true, sortOrder: 2 },
    { name: "PixelForge", slug: "pixelforge", category: "gaming", color: "#0891b2", description: "Oyun anahtarlarında %15 indirim.", affiliateUrl: "https://example.com/pixelforge", promoCode: "CENK15", sortOrder: 3 },
    { name: "HyperGear", slug: "hypergear", category: "tech", color: "#16a34a", description: "Yayıncı ekipmanlarında özel fiyat.", affiliateUrl: "https://example.com/hypergear", promoCode: "STREAM", sortOrder: 4 },
    { name: "LuckyOrbit", slug: "luckyorbit", category: "casino", color: "#ea580c", description: "Turnuva haftası ekstra çark. 18+", affiliateUrl: "https://example.com/luckyorbit", sortOrder: 5 },
    { name: "ByteArena", slug: "bytearena", category: "gaming", color: "#db2777", description: "Espor turnuvalarına ücretsiz katılım.", affiliateUrl: "https://example.com/bytearena", sortOrder: 6 },
  ]).returning();
  // Uyum: Türkiye'de casino kategorisi varsayılan olarak GİZLİ.
  await db.insert(sponsorGeoRules).values({ category: "casino", countryCode: "TR", visible: false });
  await db.insert(sponsorGames).values([
    { sponsorId: sp[0].id, title: "Sweet Fiesta", launchUrl: "https://example.com/redspin/sweet-fiesta" },
    { sponsorId: sp[0].id, title: "Gates of Olympos", launchUrl: "https://example.com/redspin/olympos" },
    { sponsorId: sp[1].id, title: "Big Bass Night", launchUrl: "https://example.com/novaplay/bass" },
  ]);
  await db.insert(channels).values({ ownerId: admin.id, slug: "cenkbey", title: "Akşam slot avı – bonus hunt!", category: "Slots" });
  await db.insert(chatMessages).values({ room: "site", userId: admin.id, body: "Platforma hoş geldiniz! Akşam 20:00'da yayındayız 🔴" });
  const d = (h: number) => new Date(Date.now() + h * 3600e3);
  await db.insert(promotions).values([
    { title: "Hafta Sonu Bonus Avı", description: "Yayında tahmin yap, sanal coin havuzundan payını al.", type: "event", startsAt: d(-2), endsAt: d(48), isFeatured: true },
    { title: "Görev Maratonu", description: "Tüm günlük görevleri bitir, ekstra coin kazan.", type: "quest", startsAt: d(-24), endsAt: d(72) },
    { title: "Originals Haftası", description: "Originals oyunlarında haftalık turnuva ödülü 2 katı.", type: "tournament", startsAt: d(24), endsAt: d(24 * 8) },
  ]);
  await db.insert(quests).values([
    { kind: "daily", title: "10 dakika yayın izle", rewardCoin: 50, rules: { event: "watch_minutes", target: 10 } },
    { kind: "daily", title: "5 Originals oyunu oyna", rewardCoin: 40, rules: { event: "originals_round", target: 5 } },
    { kind: "daily", title: "Sohbete 3 mesaj yaz", rewardCoin: 30, rules: { event: "chat_message", target: 3 } },
    { kind: "daily", title: "Bir soru sor", rewardCoin: 20, rules: { event: "question", target: 1 } },
    { kind: "social", title: "Telegram kanalına katıl", rewardCoin: 100, rules: { event: "social_telegram", target: 1, url: "https://t.me/example" } },
    { kind: "social", title: "YouTube kanalına abone ol", rewardCoin: 100, rules: { event: "social_youtube", target: 1, url: "https://youtube.com/@example" } },
  ]);
  await db.insert(predictions).values({
    title: "Bu akşamki bonus hunt 100x üstü çıkar mı?", type: "yesno", options: ["Evet", "Hayır"], closesAt: d(6),
  });
  await db.insert(storeItems).values([
    { title: "Oyuncu Kulaklığı", ticketPrice: 100, maxTickets: 500, endsAt: d(72) },
    { title: "Mekanik Klavye", ticketPrice: 150, maxTickets: 300, endsAt: d(120) },
  ]);
  await tournamentRollover();
}

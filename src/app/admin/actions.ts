"use server";
/** Admin server action'ları: her biri requireAdmin + 2FA + audit log. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  channels, chatMessages, deletionRequests, featureFlags, predictions, profiles, promotions, quests, sessions,
  siteSettings, sponsorGames, sponsorGeoRules, sponsors, storeItems, storeTickets,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { HttpError, audit, hashPassword, requireAdmin, requireUser } from "@/lib/auth";
import { applyCoinDelta } from "@/lib/coins";
import { notify } from "@/lib/platform";
import { settlePrediction } from "@/lib/predictions";
import { is2faVerified, mark2faVerified, newTotpSecret, verifyTotp } from "@/lib/totp";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => Number(f.get(k) ?? 0);

async function admin() {
  const u = await requireAdmin();
  if (u.totpEnabled && !(await is2faVerified())) throw new HttpError(403, "2FA doğrulaması gerekli.");
  if (process.env.ADMIN_REQUIRE_2FA === "true" && !u.totpEnabled) throw new HttpError(403, "Admin işlemleri için 2FA kurulumu zorunlu.");
  return u;
}

async function run(tab: string, fn: (f: FormData, actor: Awaited<ReturnType<typeof admin>>) => Promise<string | void>, f: FormData) {
  let msg: string | void = "Kaydedildi";
  try { const u = await admin(); msg = (await fn(f, u)) ?? "Kaydedildi"; await audit(u.id, `admin.${fn.name || tab}`, null, Object.fromEntries([...f.entries()].filter(([k]) => !k.startsWith("$")))); }
  catch (e) { if (e && typeof e === "object" && "digest" in e) throw e; msg = e instanceof HttpError ? e.message : "Hata: " + String((e as Error).message ?? e); }
  revalidatePath("/admin");
  redirect(`/admin?tab=${tab}&msg=${encodeURIComponent(msg)}`);
}

// ---------- 2FA ----------
export async function totpSetup() {
  const u = await requireAdmin();
  if (!u.totpEnabled) await db.update(profiles).set({ totpSecret: newTotpSecret() }).where(eq(profiles.id, u.id));
  redirect("/admin?tab=security");
}
export async function totpVerify(f: FormData) {
  const u = await requireUser();
  if (u.role !== "admin" || !u.totpSecret) redirect("/admin");
  if (!verifyTotp(u.totpSecret, s(f, "code"))) redirect("/admin?tab=security&msg=" + encodeURIComponent("Kod hatalı."));
  if (!u.totpEnabled) await db.update(profiles).set({ totpEnabled: true }).where(eq(profiles.id, u.id));
  await mark2faVerified();
  await audit(u.id, "admin.2fa_verified");
  redirect("/admin?msg=" + encodeURIComponent("2FA doğrulandı."));
}

// ---------- Flags & ayarlar ----------
export const setFlag = async (f: FormData) => run("flags", async () => {
  await db.insert(featureFlags).values({ key: s(f, "key"), enabled: s(f, "enabled") === "1" })
    .onConflictDoUpdate({ target: featureFlags.key, set: { enabled: s(f, "enabled") === "1" } });
}, f);
export const saveSetting = async (f: FormData) => run("flags", async () => {
  await db.insert(siteSettings).values({ key: s(f, "key"), value: s(f, "value") }).onConflictDoUpdate({ target: siteSettings.key, set: { value: s(f, "value") } });
}, f);

// ---------- Kullanıcılar ----------
export const userBan = async (f: FormData) => run("users", async () => {
  const h = n(f, "hours");
  await db.update(profiles).set({ bannedUntil: h > 0 ? new Date(Date.now() + h * 3600e3) : null }).where(eq(profiles.id, s(f, "id")));
  if (h > 0) await db.delete(sessions).where(eq(sessions.userId, s(f, "id")));
  return h > 0 ? `${h} saat yasaklandı` : "Yasak kaldırıldı";
}, f);
export const userRole = async (f: FormData) => run("users", async () => {
  const role = s(f, "role"); if (!["user", "mod", "host", "admin"].includes(role)) throw new HttpError(400, "Geçersiz rol");
  await db.update(profiles).set({ role }).where(eq(profiles.id, s(f, "id")));
}, f);
export const coinAdjust = async (f: FormData) => run("users", async (_f, actor) => {
  const delta = Math.trunc(n(f, "delta")); if (!delta) throw new HttpError(400, "Miktar gir");
  const bal = await applyCoinDelta({ userId: s(f, "id"), delta, reason: "admin_correction", refType: "admin", refId: actor.id });
  return `Düzeltme yapıldı. Yeni bakiye: ${bal}`;
}, f);

// ---------- Kanallar ----------
export const channelStatus = async (f: FormData) => run("channels", async () => {
  const status = s(f, "status") === "suspended" ? "suspended" : "active";
  await db.update(channels).set(status === "suspended" ? { status, isLive: false } : { status }).where(eq(channels.id, n(f, "id")));
}, f);
export const channelCreate = async (f: FormData) => run("channels", async () => {
  const owner = (await db.select().from(profiles).where(eq(profiles.username, s(f, "username").toLowerCase())).limit(1))[0];
  if (!owner) throw new HttpError(404, "Kullanıcı yok");
  const slug = s(f, "slug").toLowerCase(); if (!/^[a-z0-9-]{3,30}$/.test(slug)) throw new HttpError(400, "Geçersiz slug");
  await db.insert(channels).values({ ownerId: owner.id, slug, title: `${owner.username} yayını` });
  if (owner.role === "user") await db.update(profiles).set({ role: "host" }).where(eq(profiles.id, owner.id));
}, f);

// ---------- Sponsorlar ----------
export const sponsorSave = async (f: FormData) => run("sponsors", async () => {
  const url = s(f, "affiliateUrl"); if (!/^https:\/\//.test(url)) throw new HttpError(400, "Affiliate URL https olmalı");
  const cat = s(f, "category"); if (!["casino", "gaming", "tech", "other"].includes(cat)) throw new HttpError(400, "Geçersiz kategori");
  const v = { name: s(f, "name"), slug: s(f, "slug").toLowerCase(), category: cat, description: s(f, "description"), affiliateUrl: url, promoCode: s(f, "promoCode") || null, color: s(f, "color") || "#dc2626", ctaText: s(f, "ctaText") || "Bonusu Al", isFeatured: f.get("isFeatured") === "on", sortOrder: n(f, "sortOrder") };
  if (n(f, "id")) await db.update(sponsors).set(v).where(eq(sponsors.id, n(f, "id")));
  else await db.insert(sponsors).values(v);
}, f);
export const sponsorToggle = async (f: FormData) => run("sponsors", async () => {
  await db.update(sponsors).set({ isActive: s(f, "active") === "1" }).where(eq(sponsors.id, n(f, "id")));
}, f);
export const geoAdd = async (f: FormData) => run("sponsors", async () => {
  const cc = s(f, "cc").toUpperCase(); if (!/^[A-Z]{2}$/.test(cc)) throw new HttpError(400, "Ülke kodu 2 harf");
  const target = s(f, "target");
  await db.insert(sponsorGeoRules).values({ countryCode: cc, visible: s(f, "visible") === "1", sponsorId: target.startsWith("s:") ? Number(target.slice(2)) : null, category: target.startsWith("c:") ? target.slice(2) : null });
}, f);
export const geoDelete = async (f: FormData) => run("sponsors", async () => { await db.delete(sponsorGeoRules).where(eq(sponsorGeoRules.id, n(f, "id"))); }, f);
export const gameAdd = async (f: FormData) => run("sponsors", async () => {
  if (!/^https:\/\//.test(s(f, "launchUrl"))) throw new HttpError(400, "URL https olmalı");
  await db.insert(sponsorGames).values({ sponsorId: n(f, "sponsorId"), title: s(f, "title"), launchUrl: s(f, "launchUrl") });
}, f);

// ---------- İçerik ----------
export const promoCreate = async (f: FormData) => run("content", async () => {
  await db.insert(promotions).values({ title: s(f, "title"), description: s(f, "description"), type: s(f, "type"), startsAt: new Date(s(f, "startsAt")), endsAt: new Date(s(f, "endsAt")), isFeatured: f.get("isFeatured") === "on" });
}, f);
export const questCreate = async (f: FormData) => run("content", async () => {
  await db.insert(quests).values({ kind: s(f, "kind"), title: s(f, "title"), rewardCoin: n(f, "reward"), rules: { event: s(f, "event"), target: Math.max(1, n(f, "target")), url: s(f, "url") || undefined } });
}, f);
export const questToggle = async (f: FormData) => run("content", async () => { await db.update(quests).set({ isActive: s(f, "active") === "1" }).where(eq(quests.id, n(f, "id"))); }, f);
export const predCreate = async (f: FormData) => run("content", async () => {
  const options = s(f, "options").split(",").map((x) => x.trim()).filter(Boolean); if (options.length < 2) throw new HttpError(400, "En az 2 seçenek");
  await db.insert(predictions).values({ title: s(f, "title"), type: s(f, "type"), options, closesAt: new Date(Date.now() + n(f, "minutes") * 60e3) });
}, f);
export const predSettle = async (f: FormData) => run("content", async () => { await settlePrediction(n(f, "id"), s(f, "result") || null); return "Tahmin sonuçlandırıldı"; }, f);
export const storeDraw = async (f: FormData) => run("content", async () => {
  const tickets = await db.select().from(storeTickets).where(eq(storeTickets.itemId, n(f, "id")));
  if (!tickets.length) throw new HttpError(400, "Bilet yok");
  const w = tickets[randomBytes(4).readUInt32BE() % tickets.length];
  await db.update(storeItems).set({ winnerId: w.userId, isActive: false }).where(eq(storeItems.id, n(f, "id")));
  await notify(w.userId, "Çekilişi kazandın! 🎉", "Destek ekibi seninle iletişime geçecek.", "store");
  return "Kazanan belirlendi";
}, f);

// ---------- Moderasyon / KVKK ----------
export const msgDelete = async (f: FormData) => run("moderation", async (_f, a) => { await db.update(chatMessages).set({ deletedBy: a.id }).where(eq(chatMessages.id, n(f, "id"))); }, f);
export const deletionProcess = async (f: FormData) => run("moderation", async () => {
  const r = (await db.select().from(deletionRequests).where(eq(deletionRequests.id, n(f, "id"))).limit(1))[0];
  if (!r || r.status !== "pending") throw new HttpError(400, "Talep yok");
  await db.update(profiles).set({ username: `silinmis_${randomBytes(4).toString("hex")}`, passwordHash: hashPassword(randomBytes(16).toString("hex")), avatarUrl: null, birthYear: null, bannedUntil: new Date("2999-01-01") }).where(eq(profiles.id, r.userId));
  await db.delete(sessions).where(eq(sessions.userId, r.userId));
  await db.update(chatMessages).set({ body: "[silindi]" }).where(eq(chatMessages.userId, r.userId));
  await db.update(deletionRequests).set({ status: "done" }).where(eq(deletionRequests.id, r.id));
  return "Kullanıcı verileri anonimleştirildi";
}, f);

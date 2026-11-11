/**
 * Platform yardımcıları: görev ilerlemesi, turnuva rollover, feature flag, geo kuralları.
 */
import { headers } from "next/headers";
import { db } from "@/db";
import {
  claims, featureFlags, notifications, quests, siteSettings, sponsorGeoRules, sponsors,
  tournamentScores, tournaments, userQuests, profiles,
} from "@/db/schema";
import { and, asc, desc, eq, gt, lte, sql } from "drizzle-orm";

const TZ_OFFSET_MS = 3 * 3600e3; // Europe/Istanbul (UTC+3, DST yok)

export function today() {
  return new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}
export function startOfDay(d = new Date()) {
  const local = new Date(d.getTime() + TZ_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TZ_OFFSET_MS);
}
export const nextDayReset = () => new Date(startOfDay().getTime() + 864e5);
export function startOfWeek() {
  const s = startOfDay();
  const local = new Date(s.getTime() + TZ_OFFSET_MS);
  const dow = (local.getUTCDay() + 6) % 7; // Pazartesi = 0
  return new Date(s.getTime() - dow * 864e5);
}

// ---------------- Feature flags & ayarlar ----------------
export async function flag(key: string) {
  const r = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
  return r[0]?.enabled ?? false;
}
export async function setting(key: string, fallback = "") {
  const r = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  return r[0]?.value ?? fallback;
}

// ---------------- Geo ----------------
export async function country() {
  const h = await headers();
  return (h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || "XX").toUpperCase();
}

/** Sponsor geo kuralları: önce sponsor bazlı, sonra kategori bazlı kural uygulanır. Kural yoksa görünür. */
export async function visibleSponsors(cc?: string) {
  const code = cc ?? (await country());
  const [list, rules] = await Promise.all([
    db.select().from(sponsors).where(eq(sponsors.isActive, true)).orderBy(asc(sponsors.sortOrder)),
    db.select().from(sponsorGeoRules).where(eq(sponsorGeoRules.countryCode, code)),
  ]);
  return list.filter((s) => {
    const r1 = rules.find((r) => r.sponsorId === s.id);
    if (r1) return r1.visible;
    const r2 = rules.find((r) => !r.sponsorId && r.category === s.category);
    if (r2) return r2.visible;
    return true;
  });
}

// ---------------- Bildirim ----------------
export async function notify(userId: string, title: string, message: string, type = "info") {
  await db.insert(notifications).values({ userId, title, message, type });
}

// ---------------- Görevler ----------------
export async function bumpQuest(userId: string, event: string, amount = 1) {
  const qs = await db.select().from(quests).where(eq(quests.isActive, true));
  for (const q of qs.filter((x) => x.rules.event === event)) {
    const period = q.kind === "daily" ? today() : "once";
    const r = await db.insert(userQuests).values({ userId, questId: q.id, period, progress: amount })
      .onConflictDoUpdate({
        target: [userQuests.userId, userQuests.questId, userQuests.period],
        set: { progress: sql`least(${userQuests.progress} + ${amount}, ${q.rules.target})` },
      }).returning();
    const uq = r[0];
    if (uq && uq.progress >= q.rules.target && !uq.completedAt) {
      const done = await db.update(userQuests).set({ completedAt: new Date() })
        .where(and(eq(userQuests.userId, userId), eq(userQuests.questId, q.id), eq(userQuests.period, period), sql`${userQuests.completedAt} is null`))
        .returning();
      if (done[0]) {
        await db.insert(claims).values({
          userId, source: `Görev: ${q.title}`, amount: q.rewardCoin, uniqueKey: `quest:${q.id}:${userId}:${period}`,
        }).onConflictDoNothing();
        await notify(userId, "Görev tamamlandı", `${q.title} – ${q.rewardCoin} coin Ödüller'de seni bekliyor.`, "quest");
      }
    }
  }
}

// ---------------- Turnuvalar ----------------
/** Ödül dağılımı: sıra ağırlıkları (1. en yüksek). */
export function prizeFor(pool: number, winners: number, rank: number) {
  const weights = Array.from({ length: winners }, (_, i) => 1 / (i + 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  return Math.floor((pool * weights[rank]) / sum);
}

/** İdempotent: biten turnuvaları kapatır, ödülleri claims'e yazar, yenilerini açar. */
export async function tournamentRollover() {
  const now = new Date();
  const ended = await db.update(tournaments).set({ status: "finished" })
    .where(and(eq(tournaments.status, "active"), lte(tournaments.endsAt, now))).returning();
  for (const t of ended) {
    const top = await db.select().from(tournamentScores).where(eq(tournamentScores.tournamentId, t.id))
      .orderBy(desc(tournamentScores.score)).limit(t.winnersCount);
    for (let i = 0; i < top.length; i++) {
      const amount = prizeFor(t.prizePool, t.winnersCount, i);
      if (amount <= 0) continue;
      await db.insert(claims).values({
        userId: top[i].userId, source: `${t.type === "daily" ? "Günlük" : "Haftalık"} turnuva #${i + 1}`,
        amount, uniqueKey: `tournament:${t.id}:${top[i].userId}`,
      }).onConflictDoNothing();
      await notify(top[i].userId, "Turnuva ödülü", `${i + 1}. oldun! ${amount} coin Ödüller'de.`, "tournament");
    }
  }
  for (const type of ["daily", "weekly"] as const) {
    const active = await db.select().from(tournaments)
      .where(and(eq(tournaments.type, type), eq(tournaments.status, "active"), gt(tournaments.endsAt, now))).limit(1);
    if (!active[0]) {
      const startsAt = type === "daily" ? startOfDay() : startOfWeek();
      const endsAt = new Date(startsAt.getTime() + (type === "daily" ? 1 : 7) * 864e5);
      await db.insert(tournaments).values({
        type, startsAt, endsAt, prizePool: type === "daily" ? 5000 : 50000, winnersCount: type === "daily" ? 10 : 100,
      });
    }
  }
}

export async function addWager(userId: string, amount: number) {
  const now = new Date();
  const act = await db.select().from(tournaments)
    .where(and(eq(tournaments.status, "active"), lte(tournaments.startsAt, now), gt(tournaments.endsAt, now)));
  for (const t of act) {
    await db.insert(tournamentScores).values({ tournamentId: t.id, userId, score: amount })
      .onConflictDoUpdate({ target: [tournamentScores.tournamentId, tournamentScores.userId], set: { score: sql`${tournamentScores.score} + ${amount}` } });
  }
}

export async function userById(id: string) {
  const r = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return r[0] ?? null;
}

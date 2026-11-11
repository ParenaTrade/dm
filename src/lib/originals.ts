/**
 * Originals oyun motoru. Sonuçlar YALNIZCA sunucuda üretilir; istemci sadece animasyon gösterir.
 * Coin sanaldır – nakit değeri yoktur.
 */
import { db } from "@/db";
import { originalsRounds, userSeeds } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { HttpError } from "./auth";
import { Tx, addXp, applyCoinDelta } from "./coins";
import { HOUSE_EDGE, KENO_PAYTABLE, deck, dice, floats, keno, mines, minesMultiplier, newSeed, sha256 } from "./fair";
import { addWager, bumpQuest, startOfDay } from "./platform";

export const MIN_BET = 10, MAX_BET = 5000, DAILY_LOSS_LIMIT = 20000;
type Round = typeof originalsRounds.$inferSelect;

export async function getSeeds(userId: string, tx: Tx | typeof db = db) {
  const r = await tx.select().from(userSeeds).where(eq(userSeeds.userId, userId)).limit(1);
  if (r[0]) return r[0];
  const [s] = await tx.insert(userSeeds).values({ userId, serverSeed: newSeed(), clientSeed: newSeed().slice(0, 12) })
    .onConflictDoNothing().returning();
  return s ?? (await tx.select().from(userSeeds).where(eq(userSeeds.userId, userId)).limit(1))[0];
}

export async function rotateSeed(userId: string, clientSeed?: string) {
  const active = await db.select().from(originalsRounds).where(and(eq(originalsRounds.userId, userId), eq(originalsRounds.status, "active"))).limit(1);
  if (active[0]) throw new HttpError(400, "Aktif oyunun varken seed değiştirilemez.");
  const s = await getSeeds(userId);
  await db.update(userSeeds).set({
    prevServerSeed: s.serverSeed, prevServerSeedHash: sha256(s.serverSeed), serverSeed: newSeed(),
    clientSeed: (clientSeed || newSeed().slice(0, 12)).slice(0, 64), nonce: 0,
  }).where(eq(userSeeds.userId, userId));
}

async function checkLimits(userId: string, bet: number) {
  if (!Number.isInteger(bet) || bet < MIN_BET || bet > MAX_BET) throw new HttpError(400, `Bahis ${MIN_BET}–${MAX_BET} coin arasında olmalı.`);
  const r = await db.select({ loss: sql<string>`coalesce(sum(${originalsRounds.bet} - ${originalsRounds.payout}),0)` })
    .from(originalsRounds).where(and(eq(originalsRounds.userId, userId), gte(originalsRounds.createdAt, startOfDay())));
  if (Number(r[0]?.loss ?? 0) + bet > DAILY_LOSS_LIMIT) throw new HttpError(400, `Günlük kayıp limitine (${DAILY_LOSS_LIMIT} coin) ulaştın. Yarın tekrar dene.`);
}

/** Yeni round: nonce'u artırır, bahsi düşer, kaydı oluşturur. */
async function openRound(tx: Tx, userId: string, game: string, bet: number, floatCount: number, status: "active" | "finished") {
  await tx.execute(sql`select 1 from user_seeds where user_id = ${userId} for update`);
  const s = await getSeeds(userId, tx);
  await tx.update(userSeeds).set({ nonce: s.nonce + 1 }).where(eq(userSeeds.userId, userId));
  const fl = floats(s.serverSeed, s.clientSeed, s.nonce, floatCount);
  const [round] = await tx.insert(originalsRounds).values({
    userId, game, bet, serverSeedHash: sha256(s.serverSeed), clientSeed: s.clientSeed, nonce: s.nonce, status,
  }).returning();
  await applyCoinDelta({ userId, delta: -bet, reason: `originals_${game}_bet`, refType: "originals", refId: round.id, idempotencyKey: `orig:${round.id}:bet` }, tx);
  return { round, fl };
}

async function finish(tx: Tx, round: Round, payout: number, result: unknown) {
  await tx.update(originalsRounds).set({ status: "finished", payout, result: result as object }).where(eq(originalsRounds.id, round.id));
  if (payout > 0) await applyCoinDelta({ userId: round.userId, delta: payout, reason: `originals_${round.game}_win`, refType: "originals", refId: round.id, idempotencyKey: `orig:${round.id}:payout` }, tx);
}

async function afterBet(userId: string, bet: number) {
  await addWager(userId, bet);
  await addXp(userId, Math.max(1, Math.floor(bet / 20)));
  await bumpQuest(userId, "originals_round");
}

// ------------------- Kart yardımcıları -------------------
const rankOf = (c: number) => c % 13; // 0=A, 1..8 = 2..9, 9=10, 10=J, 11=Q, 12=K
export function handValue(cards: number[]) {
  let total = 0, aces = 0;
  for (const c of cards) { const r = rankOf(c); if (r === 0) { aces++; total += 11; } else total += Math.min(10, r + 1); }
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}
type BJState = { deck: number[]; idx: number; player: number[]; dealer: number[] };
type MinesState = { mines: number[]; count: number; revealed: number[] };

/** İstemciye giden güvenli görünüm (gizli bilgiler maskelenir). */
export function publicRound(r: Round) {
  const base = { id: r.id, game: r.game, bet: r.bet, status: r.status, payout: r.payout, result: r.result, nonce: r.nonce, serverSeedHash: r.serverSeedHash, clientSeed: r.clientSeed };
  if (r.game === "mines") {
    const s = r.state as MinesState;
    return { ...base, view: { count: s.count, revealed: s.revealed, mines: r.status === "finished" ? s.mines : undefined, multiplier: minesMultiplier(s.count, s.revealed.length), next: minesMultiplier(s.count, s.revealed.length + 1) } };
  }
  if (r.game === "blackjack") {
    const s = r.state as BJState;
    const hide = r.status === "active";
    return { ...base, view: { player: s.player, dealer: hide ? [s.dealer[0]] : s.dealer, playerValue: handValue(s.player), dealerValue: hide ? handValue([s.dealer[0]]) : handValue(s.dealer) } };
  }
  return base;
}

// ------------------- Oyunlar -------------------
export async function playDice(userId: string, bet: number, target: number, over: boolean) {
  if (target < 2 || target > 98) throw new HttpError(400, "Hedef 2–98 arasında olmalı.");
  await checkLimits(userId, bet);
  const r = await db.transaction(async (tx) => {
    const { round, fl } = await openRound(tx, userId, "dice", bet, 1, "finished");
    const roll = dice(fl[0]);
    const chance = over ? 100 - target : target;
    const multiplier = Math.floor(((100 * (1 - HOUSE_EDGE)) / chance) * 10000) / 10000;
    const win = over ? roll > target : roll < target;
    const payout = win ? Math.floor(bet * multiplier) : 0;
    await finish(tx, round, payout, { roll, target, over, multiplier, win });
    return { ...round, status: "finished", payout, result: { roll, target, over, multiplier, win } } as Round;
  });
  await afterBet(userId, bet);
  return publicRound(r);
}

export async function playKeno(userId: string, bet: number, picks: number[]) {
  const set = Array.from(new Set(picks));
  if (set.length < 1 || set.length > 10 || set.some((n) => !Number.isInteger(n) || n < 1 || n > 40)) throw new HttpError(400, "1–10 arası sayı seç (1–40).");
  await checkLimits(userId, bet);
  const r = await db.transaction(async (tx) => {
    const { round, fl } = await openRound(tx, userId, "keno", bet, 39, "finished");
    const drawn = keno(fl);
    const hits = set.filter((n) => drawn.includes(n));
    const multiplier = KENO_PAYTABLE[set.length][hits.length] ?? 0;
    const payout = Math.floor(bet * multiplier);
    const result = { picks: set, drawn, hits, multiplier };
    await finish(tx, round, payout, result);
    return { ...round, status: "finished", payout, result } as Round;
  });
  await afterBet(userId, bet);
  return publicRound(r);
}

async function lockActive(tx: Tx, userId: string, roundId: number, game: string) {
  await tx.execute(sql`select 1 from originals_rounds where id = ${roundId} for update`);
  const r = (await tx.select().from(originalsRounds).where(and(eq(originalsRounds.id, roundId), eq(originalsRounds.userId, userId))).limit(1))[0];
  if (!r || r.game !== game) throw new HttpError(404, "Oyun bulunamadı.");
  if (r.status !== "active") throw new HttpError(400, "Bu oyun zaten bitti.");
  return r;
}

async function ensureNoActive(userId: string, game: string) {
  const a = await db.select().from(originalsRounds).where(and(eq(originalsRounds.userId, userId), eq(originalsRounds.game, game), eq(originalsRounds.status, "active"))).limit(1);
  if (a[0]) throw new HttpError(400, "Önce aktif oyununu bitir.");
}

export async function minesStart(userId: string, bet: number, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 24) throw new HttpError(400, "Mayın sayısı 1–24 olmalı.");
  await ensureNoActive(userId, "mines");
  await checkLimits(userId, bet);
  const r = await db.transaction(async (tx) => {
    const { round, fl } = await openRound(tx, userId, "mines", bet, 24, "active");
    const state: MinesState = { mines: mines(fl, count), count, revealed: [] };
    await tx.update(originalsRounds).set({ state }).where(eq(originalsRounds.id, round.id));
    return { ...round, state } as Round;
  });
  await afterBet(userId, bet);
  return publicRound(r);
}

export async function minesAct(userId: string, roundId: number, action: "reveal" | "cashout", tile?: number) {
  return db.transaction(async (tx) => {
    const r = await lockActive(tx, userId, roundId, "mines");
    const s = r.state as MinesState;
    if (action === "reveal") {
      if (tile == null || tile < 0 || tile > 24 || s.revealed.includes(tile)) throw new HttpError(400, "Geçersiz kare.");
      s.revealed.push(tile);
      if (s.mines.includes(tile)) {
        await tx.update(originalsRounds).set({ state: s }).where(eq(originalsRounds.id, r.id));
        await finish(tx, r, 0, { busted: tile, revealed: s.revealed.length });
        return publicRound({ ...r, state: s, status: "finished", payout: 0, result: { busted: tile } });
      }
      if (s.revealed.length < 25 - s.count) {
        await tx.update(originalsRounds).set({ state: s }).where(eq(originalsRounds.id, r.id));
        return publicRound({ ...r, state: s });
      }
    }
    if (s.revealed.length === 0) throw new HttpError(400, "Önce en az bir kare aç.");
    const multiplier = minesMultiplier(s.count, s.revealed.length);
    const payout = Math.floor(r.bet * multiplier);
    await tx.update(originalsRounds).set({ state: s }).where(eq(originalsRounds.id, r.id));
    await finish(tx, r, payout, { cashout: true, multiplier });
    return publicRound({ ...r, state: s, status: "finished", payout, result: { cashout: true, multiplier } });
  });
}

function settleBJ(s: BJState, bet: number, natural = false) {
  const p = handValue(s.player);
  if (p > 21) return { payout: 0, outcome: "Battın" };
  while (handValue(s.dealer) < 17) s.dealer.push(s.deck[s.idx++]);
  const d = handValue(s.dealer);
  const dealerBJ = d === 21 && s.dealer.length === 2;
  if (natural) return dealerBJ ? { payout: bet, outcome: "Berabere" } : { payout: Math.floor(bet * 2.5), outcome: "Blackjack!" };
  if (dealerBJ) return { payout: 0, outcome: "Krupiye Blackjack" };
  if (d > 21 || p > d) return { payout: bet * 2, outcome: "Kazandın" };
  if (p === d) return { payout: bet, outcome: "Berabere" };
  return { payout: 0, outcome: "Kaybettin" };
}

export async function bjStart(userId: string, bet: number) {
  await ensureNoActive(userId, "blackjack");
  await checkLimits(userId, bet);
  const r = await db.transaction(async (tx) => {
    const { round, fl } = await openRound(tx, userId, "blackjack", bet, 51, "active");
    const d = deck(fl);
    const s: BJState = { deck: d, idx: 4, player: [d[0], d[2]], dealer: [d[1], d[3]] };
    await tx.update(originalsRounds).set({ state: s }).where(eq(originalsRounds.id, round.id));
    if (handValue(s.player) === 21) {
      const res = settleBJ(s, bet, true);
      await tx.update(originalsRounds).set({ state: s }).where(eq(originalsRounds.id, round.id));
      await finish(tx, { ...round, state: s }, res.payout, res);
      return { ...round, state: s, status: "finished", payout: res.payout, result: res } as Round;
    }
    return { ...round, state: s } as Round;
  });
  await afterBet(userId, bet);
  return publicRound(r);
}

export async function bjAct(userId: string, roundId: number, action: "hit" | "stand") {
  return db.transaction(async (tx) => {
    const r = await lockActive(tx, userId, roundId, "blackjack");
    const s = r.state as BJState;
    if (action === "hit") {
      s.player.push(s.deck[s.idx++]);
      if (handValue(s.player) < 21) {
        await tx.update(originalsRounds).set({ state: s }).where(eq(originalsRounds.id, r.id));
        return publicRound({ ...r, state: s });
      }
    }
    const res = settleBJ(s, r.bet);
    await tx.update(originalsRounds).set({ state: s }).where(eq(originalsRounds.id, r.id));
    await finish(tx, r, res.payout, res);
    return publicRound({ ...r, state: s, status: "finished", payout: res.payout, result: res });
  });
}

/** Doğrulama: verilen seed'lerle sonucu yeniden hesaplar. */
export function verify(game: string, serverSeed: string, clientSeed: string, nonce: number, minesCount = 3) {
  const hash = sha256(serverSeed);
  if (game === "dice") return { hash, roll: dice(floats(serverSeed, clientSeed, nonce, 1)[0]) };
  if (game === "keno") return { hash, drawn: keno(floats(serverSeed, clientSeed, nonce, 39)) };
  if (game === "mines") return { hash, mines: mines(floats(serverSeed, clientSeed, nonce, 24), minesCount) };
  const d = deck(floats(serverSeed, clientSeed, nonce, 51));
  return { hash, firstCards: d.slice(0, 8) };
}

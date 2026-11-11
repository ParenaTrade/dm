/**
 * TEK bakiye değiştirme noktası: applyCoinDelta.
 * Supabase sürümündeki `apply_coin_delta` SECURITY DEFINER RPC'nin karşılığıdır:
 *  1. SELECT ... FOR UPDATE ile kullanıcı satırını kilitler (race condition yok)
 *  2. idempotency_key daha önce işlendiyse aynı sonucu döner (çifte çalışma güvenli)
 *  3. negatif bakiyeyi engeller
 *  4. append-only coin_ledger kaydı ekler
 * Coin SANALDIR: gerçek parayla alınamaz, nakde çevrilemez.
 */
import { db } from "@/db";
import { coinLedger, profiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { HttpError, levelForXp } from "./auth";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DeltaInput = {
  userId: string;
  delta: number;
  reason: string;
  refType?: string;
  refId?: string | number;
  idempotencyKey?: string;
};

export async function applyCoinDelta(input: DeltaInput, tx?: Tx): Promise<number> {
  const run = async (t: Tx) => {
    if (!Number.isInteger(input.delta)) throw new HttpError(400, "Geçersiz miktar.");
    if (input.idempotencyKey) {
      const prev = await t.select().from(coinLedger).where(eq(coinLedger.idempotencyKey, input.idempotencyKey)).limit(1);
      if (prev[0]) return prev[0].balanceAfter;
    }
    const locked = await t.execute<{ coin_balance: string }>(
      sql`select coin_balance from profiles where id = ${input.userId} for update`,
    );
    const row = locked.rows[0];
    if (!row) throw new HttpError(404, "Kullanıcı bulunamadı.");
    const next = Number(row.coin_balance) + input.delta;
    if (next < 0) throw new HttpError(400, "Yetersiz coin bakiyesi.");
    await t.update(profiles).set({ coinBalance: next }).where(eq(profiles.id, input.userId));
    await t.insert(coinLedger).values({
      userId: input.userId, delta: input.delta, reason: input.reason,
      refType: input.refType ?? null, refId: input.refId != null ? String(input.refId) : null,
      idempotencyKey: input.idempotencyKey ?? null, balanceAfter: next,
    });
    return next;
  };
  return tx ? run(tx) : db.transaction(run);
}

/** XP ekler ve seviyeyi yeniden hesaplar (atomik SQL). */
export async function addXp(userId: string, amount: number, tx?: Tx) {
  const t = tx ?? db;
  const r = await t.execute<{ xp: number }>(
    sql`update profiles set xp = xp + ${amount} where id = ${userId} returning xp`,
  );
  const xp = Number(r.rows[0]?.xp ?? 0);
  await t.update(profiles).set({ level: levelForXp(xp) }).where(eq(profiles.id, userId));
}

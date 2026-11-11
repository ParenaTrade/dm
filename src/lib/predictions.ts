/**
 * `settle-prediction` karşılığı. Tek transaction içinde:
 *  - tahmin satırı FOR UPDATE kilitlenir; status 'open' değilse hiçbir şey yapılmaz (idempotent)
 *  - parimutuel: kazanan payı = stake × toplam havuz / kazananların toplam stake'i
 *  - kazanan yoksa veya iptal edildiyse herkes stake'ini geri alır
 *  - her ödeme applyCoinDelta(idempotencyKey) ile
 */
import { db } from "@/db";
import { predictionEntries, predictions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { HttpError } from "./auth";
import { applyCoinDelta } from "./coins";
import { notify } from "./platform";

export async function settlePrediction(id: number, result: string | null) {
  const notes: { userId: string; payout: number }[] = [];
  await db.transaction(async (tx) => {
    const locked = await tx.execute<{ status: string; total_pool: string; options: string[]; title: string }>(
      sql`select status, total_pool, options, title from predictions where id = ${id} for update`,
    );
    const p = locked.rows[0];
    if (!p) throw new HttpError(404, "Tahmin bulunamadı.");
    if (p.status !== "open") return;
    if (result !== null && !p.options.includes(result)) throw new HttpError(400, "Geçersiz sonuç seçeneği.");
    const entries = await tx.select().from(predictionEntries).where(eq(predictionEntries.predictionId, id));
    const pool = Number(p.total_pool);
    const winners = result === null ? [] : entries.filter((e) => e.option === result);
    const winStake = winners.reduce((a, e) => a + e.amount, 0);
    const refund = result === null || winStake === 0;
    for (const e of entries) {
      const payout = refund ? e.amount : e.option === result ? Math.floor((e.amount * pool) / winStake) : 0;
      await tx.update(predictionEntries).set({ payout }).where(eq(predictionEntries.id, e.id));
      if (payout > 0) {
        await applyCoinDelta({ userId: e.userId, delta: payout, reason: refund ? "prediction_refund" : "prediction_win", refType: "prediction", refId: id, idempotencyKey: `pred:${id}:${e.id}` }, tx);
      }
      notes.push({ userId: e.userId, payout });
    }
    await tx.update(predictions).set({ status: result === null ? "cancelled" : "settled", result }).where(eq(predictions.id, id));
  });
  for (const n of notes) await notify(n.userId, "Tahmin sonuçlandı", n.payout > 0 ? `${n.payout} coin hesabına eklendi.` : "Bu sefer olmadı.", "prediction");
}

/** Tahmine katılım: coin stake edilir (atomik), havuz büyür. */
import { z } from "zod";
import { db } from "@/db";
import { predictionEntries, predictions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { route } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { applyCoinDelta } from "@/lib/coins";
import { flag } from "@/lib/platform";

const schema = z.object({ id: z.number().int(), option: z.string().min(1), amount: z.number().int().min(10).max(10000) });

export const POST = route(async (req) => {
  const u = await requireUser();
  if (!(await flag("predictions_enabled"))) throw new HttpError(403, "Tahmin sistemi şu an kapalı.");
  const i = schema.parse(await req.json());
  await db.transaction(async (tx) => {
    const r = await tx.execute<{ status: string; closes_at: string; options: string[] }>(
      sql`select status, closes_at, options from predictions where id = ${i.id} for update`,
    );
    const p = r.rows[0];
    if (!p) throw new HttpError(404, "Tahmin bulunamadı.");
    if (p.status !== "open" || new Date(p.closes_at) < new Date()) throw new HttpError(400, "Bu tahmine giriş kapandı.");
    if (!p.options.includes(i.option)) throw new HttpError(400, "Geçersiz seçenek.");
    const [e] = await tx.insert(predictionEntries).values({ predictionId: i.id, userId: u.id, option: i.option, amount: i.amount }).returning();
    await applyCoinDelta({ userId: u.id, delta: -i.amount, reason: "prediction_stake", refType: "prediction", refId: e.id }, tx);
    await tx.update(predictions).set({ totalPool: sql`${predictions.totalPool} + ${i.amount}` }).where(eq(predictions.id, i.id));
  });
  return { ok: true };
});

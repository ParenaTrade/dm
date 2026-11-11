"use server";
/**
 * Kullanıcı server action'ları. Next.js server action'ları Origin kontrolü ile CSRF korumalıdır.
 * Hata durumunda ?msg= ile aynı sayfaya geri yönlendirilir.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { claims, deletionRequests, profiles, questionVotes, questions, quests, storeItems, storeTickets } from "@/db/schema";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { HttpError, audit, isStaff, requireUser } from "@/lib/auth";
import { applyCoinDelta } from "@/lib/coins";
import { bumpQuest, flag, startOfDay } from "@/lib/platform";

async function guard(path: string, fn: () => Promise<string | void>) {
  let msg: string | void;
  try { msg = await fn(); } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    msg = e instanceof HttpError ? e.message : "İşlem başarısız oldu.";
    if (!(e instanceof HttpError)) console.error(e);
  }
  revalidatePath(path);
  redirect(msg ? `${path}?msg=${encodeURIComponent(msg)}` : path);
}

/** Tek ödülü topla: claim satırı kilitlenir; yalnızca pending ise bakiye eklenir (idempotent). */
export async function claimReward(formData: FormData) {
  await guard("/claims", async () => {
    const u = await requireUser();
    const id = Number(formData.get("id"));
    const ids = id ? [id] : (await db.select({ id: claims.id }).from(claims).where(and(eq(claims.userId, u.id), eq(claims.status, "pending")))).map((c) => c.id);
    let total = 0;
    for (const cid of ids) {
      await db.transaction(async (tx) => {
        const r = await tx.execute<{ status: string; amount: number; user_id: string }>(sql`select status, amount, user_id from claims where id = ${cid} for update`);
        const c = r.rows[0];
        if (!c || c.user_id !== u.id || c.status !== "pending") return;
        await tx.update(claims).set({ status: "claimed", claimedAt: new Date() }).where(eq(claims.id, cid));
        await applyCoinDelta({ userId: u.id, delta: c.amount, reason: "claim", refType: "claim", refId: cid, idempotencyKey: `claim:${cid}` }, tx);
        total += c.amount;
      });
    }
    return total ? `${total} coin toplandı!` : "Toplanacak ödül yok.";
  });
}

export async function completeSocialQuest(formData: FormData) {
  await guard("/quests", async () => {
    const u = await requireUser();
    const q = (await db.select().from(quests).where(eq(quests.id, Number(formData.get("id")))).limit(1))[0];
    if (!q || q.kind !== "social") throw new HttpError(404, "Görev bulunamadı.");
    await bumpQuest(u.id, q.rules.event);
    return "Görev doğrulandı – ödülünü Ödüller sayfasından topla.";
  });
}

export async function askQuestion(formData: FormData) {
  await guard("/ask", async () => {
    const u = await requireUser();
    const body = String(formData.get("body") ?? "").replace(/[\u0000-\u001f]/g, " ").trim();
    if (body.length < 5 || body.length > 280) throw new HttpError(400, "Soru 5–280 karakter olmalı.");
    const [{ n }] = await db.select({ n: count() }).from(questions).where(and(eq(questions.userId, u.id), gte(questions.createdAt, startOfDay())));
    if (n >= 5) throw new HttpError(429, "Günlük 5 soru hakkını kullandın.");
    await db.insert(questions).values({ userId: u.id, body, isAnonymous: formData.get("anon") === "on" });
    await bumpQuest(u.id, "question");
    return "Sorun gönderildi!";
  });
}

export async function voteQuestion(formData: FormData) {
  await guard("/ask", async () => {
    const u = await requireUser();
    const id = Number(formData.get("id"));
    const ins = await db.insert(questionVotes).values({ questionId: id, userId: u.id }).onConflictDoNothing().returning();
    if (ins[0]) await db.update(questions).set({ votes: sql`${questions.votes} + 1` }).where(eq(questions.id, id));
    else {
      await db.delete(questionVotes).where(and(eq(questionVotes.questionId, id), eq(questionVotes.userId, u.id)));
      await db.update(questions).set({ votes: sql`greatest(${questions.votes} - 1, 0)` }).where(eq(questions.id, id));
    }
  });
}

export async function markQuestion(formData: FormData) {
  await guard("/ask", async () => {
    const u = await requireUser();
    if (!isStaff(u) && u.role !== "host") throw new HttpError(403, "Yetkin yok.");
    const status = String(formData.get("status"));
    if (!["pending", "answered", "selected"].includes(status)) throw new HttpError(400, "Geçersiz durum.");
    await db.update(questions).set({ status }).where(eq(questions.id, Number(formData.get("id"))));
  });
}

export async function buyTicket(formData: FormData) {
  await guard("/store", async () => {
    const u = await requireUser();
    if (!(await flag("store_enabled"))) throw new HttpError(403, "Store şu an kapalı.");
    const itemId = Number(formData.get("id"));
    await db.transaction(async (tx) => {
      await tx.execute(sql`select 1 from store_items where id = ${itemId} for update`);
      const it = (await tx.select().from(storeItems).where(eq(storeItems.id, itemId)).limit(1))[0];
      if (!it || !it.isActive || it.endsAt < new Date()) throw new HttpError(400, "Çekiliş aktif değil.");
      const [{ n }] = await tx.select({ n: count() }).from(storeTickets).where(eq(storeTickets.itemId, itemId));
      if (n >= it.maxTickets) throw new HttpError(400, "Biletler tükendi.");
      const [t] = await tx.insert(storeTickets).values({ itemId, userId: u.id }).returning();
      await applyCoinDelta({ userId: u.id, delta: -it.ticketPrice, reason: "store_ticket", refType: "store_ticket", refId: t.id }, tx);
    });
    return "Bilet alındı. Bol şans!";
  });
}

export async function updateProfile(formData: FormData) {
  await guard("/profile", async () => {
    const u = await requireUser();
    const by = Number(formData.get("birthYear"));
    if (by && (by < 1900 || new Date().getFullYear() - by < 18)) throw new HttpError(400, "Geçerli bir doğum yılı gir (18+).");
    await db.update(profiles).set({
      birthYear: by || u.birthYear, hideOnLeaderboard: formData.get("hide") === "on",
      avatarUrl: String(formData.get("avatarUrl") ?? "").startsWith("https://") ? String(formData.get("avatarUrl")) : u.avatarUrl,
      ageConfirmedAt: u.ageConfirmedAt ?? (by ? new Date() : null),
    }).where(eq(profiles.id, u.id));
    return "Profil güncellendi.";
  });
}

export async function requestDeletion() {
  await guard("/profile", async () => {
    const u = await requireUser();
    await db.insert(deletionRequests).values({ userId: u.id });
    await audit(u.id, "kvkk.deletion_request");
    return "Veri silme talebin alındı. 30 gün içinde işlenecek.";
  });
}

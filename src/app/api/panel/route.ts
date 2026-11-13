import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, chatMessages, moderators, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  const isStaff = user?.role === "host" || user?.role === "moderator";
  if (!isStaff) return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });

  const recent = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.status, "deleted"))
    .orderBy(desc(chatMessages.id))
    .limit(20);

  const banned = await db
    .select({
      id: users.id,
      nickname: users.nickname,
      email: users.email,
      role: users.role,
      mutedUntil: users.mutedUntil,
      bannedUntil: users.bannedUntil,
      messageCount: users.messageCount,
    })
    .from(users)
    .orderBy(desc(users.lastSeenAt))
    .limit(50);

  const logs = await db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(30);

  return Response.json({
    ok: true,
    deletedMessages: recent.map((row) => ({
      id: row.id,
      nickname: row.nickname,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    })),
    users: banned.map((row) => ({
      id: row.id,
      nickname: row.nickname,
      email: row.email ?? "",
      role: row.role,
      mutedUntil: row.mutedUntil ? row.mutedUntil.toISOString() : null,
      bannedUntil: row.bannedUntil ? row.bannedUntil.toISOString() : null,
      messageCount: row.messageCount,
    })),
    logs: logs.map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      target: row.target,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "host") {
    return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  }
  const payload: { action?: string; userId?: number } = await request.json().catch(() => ({}));
  if (payload.action === "promote" || payload.action === "demote") {
    const rows = await db.select().from(users).where(eq(users.id, Number(payload.userId))).limit(1);
    const target = rows[0];
    if (!target?.email) {
      return Response.json({ ok: false, error: "Yalnızca Google hesabı olan kullanıcılar yetkilendirilebilir." }, { status: 400 });
    }
    if (target.role === "host") {
      return Response.json({ ok: false, error: "Admin rolü değiştirilemez." }, { status: 400 });
    }
    if (payload.action === "promote") {
      await db
        .insert(moderators)
        .values({ email: target.email, nickname: target.nickname, nicknameLower: target.email, addedBy: user.nickname })
        .onConflictDoNothing();
      await db.update(users).set({ role: "moderator" }).where(eq(users.id, target.id));
    } else {
      await db.delete(moderators).where(eq(moderators.email, target.email));
      await db.update(users).set({ role: "viewer" }).where(eq(users.id, target.id));
    }
    return Response.json({ ok: true });
  }
  if (payload.action === "purgeLogs") {
    await db.delete(activityLog);
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false, error: "Bilinmeyen işlem" }, { status: 400 });
}

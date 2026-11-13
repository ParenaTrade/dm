import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, moderators, users } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { findUserByNickname, getCurrentUser, normalizeNickname } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await ensureSeed();
  const rows = await db.select().from(moderators).orderBy(asc(moderators.id));
  const staffUsers = await db
    .select({ id: users.id, nickname: users.nickname, role: users.role, messageCount: users.messageCount })
    .from(users)
    .where(eq(users.role, "moderator"));

  return Response.json({
    ok: true,
    moderators: rows.map((row) => ({
      id: row.id,
      nickname: row.nickname,
      addedBy: row.addedBy,
      canDelete: row.canDelete,
      canBan: row.canBan,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    })),
    staff: staffUsers,
    counts: {
      users: await db.select({ c: sql<number>`count(*)::int` }).from(users).then((r) => r[0]?.c ?? 0),
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "host") {
    return Response.json({ ok: false, error: "Sadece yayıncı moderatör ekleyebilir." }, { status: 403 });
  }

  const payload: { nickname?: string; note?: string } = await request.json().catch(() => ({}));
  const nickname = normalizeNickname(payload.nickname ?? "");
  if (nickname.length < 2) {
    return Response.json({ ok: false, error: "Geçerli bir takma ad gir." }, { status: 400 });
  }

  const lower = nickname.toLocaleLowerCase("tr");
  await db
    .insert(moderators)
    .values({
      nickname,
      nicknameLower: lower,
      addedBy: user.nickname,
      note: (payload.note ?? "").slice(0, 120),
    })
    .onConflictDoUpdate({
      target: moderators.nicknameLower,
      set: { addedBy: user.nickname, note: (payload.note ?? "").slice(0, 120) },
    });

  const existingUser = await findUserByNickname(nickname);
  if (existingUser) {
    await db.update(users).set({ role: "moderator" }).where(eq(users.id, existingUser.id));
  }

  await db.insert(activityLog).values({ actor: user.nickname, action: "moderator_ekledi", target: nickname });

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "host") {
    return Response.json({ ok: false, error: "Sadece yayıncı kaldırabilir." }, { status: 403 });
  }
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return Response.json({ ok: false, error: "id gerekli" }, { status: 400 });

  const rows = await db.select().from(moderators).where(eq(moderators.id, id)).limit(1);
  if (!rows[0]) return Response.json({ ok: false, error: "Bulunamadı" }, { status: 404 });

  await db.delete(moderators).where(eq(moderators.id, id));
  const existingUser = await findUserByNickname(rows[0].nickname);
  if (existingUser && existingUser.role === "moderator") {
    await db.update(users).set({ role: "viewer" }).where(eq(users.id, existingUser.id));
  }
  await db.insert(activityLog).values({ actor: user.nickname, action: "moderator_cikardi", target: rows[0].nickname });

  return Response.json({ ok: true });
}

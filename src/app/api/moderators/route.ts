import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, moderators, users } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { findUserByEmail, getCurrentUser, isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  await ensureSeed();
  const me = await getCurrentUser();
  if (!isStaff(me)) return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });

  const rows = await db.select().from(moderators).orderBy(asc(moderators.id));
  return Response.json({
    ok: true,
    moderators: rows.map((row) => ({
      id: row.id,
      email: row.email ?? "",
      nickname: row.nickname,
      addedBy: row.addedBy,
      canDelete: row.canDelete,
      canBan: row.canBan,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

/** Yalnızca admin (yayıncı): Google e-postası ile moderatör ekler. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "host") {
    return Response.json({ ok: false, error: "Sadece yayıncı moderatör ekleyebilir." }, { status: 403 });
  }

  const payload: { email?: string; note?: string } = await request.json().catch(() => ({}));
  const email = (payload.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return Response.json({ ok: false, error: "Geçerli bir Google e-posta adresi gir." }, { status: 400 });
  }

  const existingUser = await findUserByEmail(email);
  const nickname = existingUser?.nickname ?? email.split("@")[0].slice(0, 20);
  const note = (payload.note ?? "").slice(0, 120);

  await db
    .insert(moderators)
    .values({ email, nickname, nicknameLower: email, addedBy: user.nickname, note })
    .onConflictDoUpdate({ target: moderators.email, set: { addedBy: user.nickname, note } });

  if (existingUser && existingUser.role !== "host") {
    await db.update(users).set({ role: "moderator" }).where(eq(users.id, existingUser.id));
  }
  await db.insert(activityLog).values({ actor: user.nickname, action: "moderator_ekledi", target: email });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "host") {
    return Response.json({ ok: false, error: "Sadece yayıncı kaldırabilir." }, { status: 403 });
  }
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ ok: false, error: "id gerekli" }, { status: 400 });

  const rows = await db.select().from(moderators).where(eq(moderators.id, id)).limit(1);
  if (!rows[0]) return Response.json({ ok: false, error: "Bulunamadı" }, { status: 404 });

  await db.delete(moderators).where(eq(moderators.id, id));
  if (rows[0].email) {
    const u = await findUserByEmail(rows[0].email);
    if (u && u.role === "moderator") await db.update(users).set({ role: "viewer" }).where(eq(users.id, u.id));
  }
  await db.insert(activityLog).values({ actor: user.nickname, action: "moderator_cikardi", target: rows[0].email ?? rows[0].nickname });
  return Response.json({ ok: true });
}

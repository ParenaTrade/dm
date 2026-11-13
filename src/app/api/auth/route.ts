import { ensureSeed } from "@/lib/seed";
import { createSession, destroySession, getCurrentUser, upsertUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  await ensureSeed();
  let payload: { nickname?: string; hostPassword?: string } = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const nickname = (payload.nickname ?? "").trim();
  if (nickname.length < 2) {
    return Response.json({ ok: false, error: "Takma ad en az 2 karakter olmalı." }, { status: 400 });
  }

  const user = await upsertUser(nickname);

  if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
    return Response.json(
      { ok: false, error: "Hesabınız yayından uzaklaştırılmış. Lütfen daha sonra tekrar deneyin." },
      { status: 403 },
    );
  }

  const hostPassword = (payload.hostPassword ?? "").trim();
  const expected = process.env.HOST_PASSWORD ?? "berkbey";
  if (hostPassword && hostPassword === expected) {
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(users).set({ role: "host", isVip: true }).where(eq(users.id, user.id));
    user.role = "host";
    user.isVip = true;
  }

  await createSession(user.id);
  return Response.json({
    ok: true,
    user: {
      id: user.id,
      nickname: user.nickname,
      role: user.role,
      accent: user.accent,
      isVip: user.isVip,
      mutedUntil: user.mutedUntil ? user.mutedUntil.toISOString() : null,
      bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
    },
  });
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ ok: true, user });
}

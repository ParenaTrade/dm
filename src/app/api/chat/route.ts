import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages, participants, users } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { getCurrentUser } from "@/lib/session";
import { getActiveStream, toParticipantInfo } from "@/lib/stream-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await ensureSeed();
  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? 0) || 0;

  const stream = await getActiveStream();
  if (!stream) return Response.json({ ok: true, messages: [] });

  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.streamId, stream.id), gt(chatMessages.id, since)))
    .orderBy(asc(chatMessages.id))
    .limit(200);

  const user = await getCurrentUser();
  let me = null;
  if (user) {
    const rowsP = await db
      .select()
      .from(participants)
      .where(and(eq(participants.streamId, stream.id), eq(participants.userId, user.id)))
      .limit(1);
    me = rowsP[0] ? toParticipantInfo(rowsP[0]) : null;
  }

  return Response.json({
    ok: true,
    stream: {
      id: stream.id,
      chatLocked: stream.chatLocked,
      slowModeSeconds: stream.slowModeSeconds,
      status: stream.status,
      title: stream.title,
    },
    messages: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      nickname: row.nickname,
      role: row.role,
      accent: row.accent,
      body: row.body,
      status: row.status,
      isPinned: row.isPinned,
      createdAt: row.createdAt.toISOString(),
    })),
    me,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Önce giriş yap." }, { status: 401 });

  const payload: { text?: string } = await request.json().catch(() => ({}));
  const text = (payload.text ?? "").trim().slice(0, 400);
  if (!text) return Response.json({ ok: false, error: "Mesaj boş." }, { status: 400 });

  const stream = await getActiveStream();
  if (!stream) return Response.json({ ok: false, error: "Yayın yok." }, { status: 404 });

  const fresh = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const dbUser = fresh[0];

  if (dbUser?.bannedUntil && dbUser.bannedUntil.getTime() > Date.now()) {
    return Response.json({ ok: false, error: "Sohbette yasaklısın." }, { status: 403 });
  }
  if (dbUser?.mutedUntil && dbUser.mutedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((dbUser.mutedUntil.getTime() - Date.now()) / 60000);
    return Response.json({ ok: false, error: `Susturuldun. ${mins} dk kaldı.` }, { status: 403 });
  }

  const isStaff = user.role === "host" || user.role === "moderator";
  if (stream.chatLocked && !isStaff) {
    return Response.json({ ok: false, error: "Sohbet kilitli." }, { status: 403 });
  }

  const last = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.streamId, stream.id), eq(chatMessages.userId, user.id)))
    .orderBy(desc(chatMessages.id))
    .limit(1);

  if (last[0]) {
    const elapsed = (Date.now() - last[0].createdAt.getTime()) / 1000;
    const cooldown = Math.max(isStaff ? 0 : 1.5, isStaff ? 0 : stream.slowModeSeconds);
    if (elapsed < cooldown) {
      return Response.json(
        { ok: false, error: `Yavaş mod aktif. ${Math.ceil(cooldown - elapsed)} sn bekle.` },
        { status: 429 },
      );
    }
  }

  const inserted = await db
    .insert(chatMessages)
    .values({
      streamId: stream.id,
      userId: user.id,
      nickname: user.nickname,
      role: user.role,
      accent: user.accent,
      body: text,
    })
    .returning();

  if (dbUser) {
    await db
      .update(users)
      .set({ messageCount: dbUser.messageCount + 1, lastSeenAt: new Date() })
      .where(eq(users.id, user.id));
  }

  const row = inserted[0];
  return Response.json({
    ok: true,
    message: {
      id: row.id,
      userId: row.userId,
      nickname: row.nickname,
      role: row.role,
      accent: row.accent,
      body: row.body,
      status: row.status,
      isPinned: row.isPinned,
      createdAt: row.createdAt.toISOString(),
    },
  });
}

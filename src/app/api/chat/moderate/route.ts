import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, chatMessages, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { getActiveStream } from "@/lib/stream-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_MUTE_MINUTES = 10;
const DEFAULT_BAN_MINUTES = 60;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Oturum gerekli" }, { status: 401 });

  const isStaff = user.role === "host" || user.role === "moderator";
  if (!isStaff) return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });

  const stream = await getActiveStream();
  if (!stream) return Response.json({ ok: false, error: "Yayın yok" }, { status: 404 });

  const body: {
    action?: string;
    messageId?: number;
    targetUserId?: number;
    minutes?: number;
  } = await request.json().catch(() => ({}));

  const log = async (action: string, target: string) => {
    await db.insert(activityLog).values({ actor: user.nickname, action, target });
  };

  switch (body.action) {
    case "delete": {
      const updated = await db
        .update(chatMessages)
        .set({ status: "deleted" })
        .where(and(eq(chatMessages.id, Number(body.messageId)), eq(chatMessages.streamId, stream.id)))
        .returning();
      if (updated[0]) await log("mesaj_sildi", updated[0].nickname);
      return Response.json({ ok: true });
    }
    case "pin": {
      const target = await db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.id, Number(body.messageId)), eq(chatMessages.streamId, stream.id)))
        .limit(1);
      if (!target[0]) return Response.json({ ok: false }, { status: 404 });
      const next = !target[0].isPinned;
      if (next) {
        await db
          .update(chatMessages)
          .set({ isPinned: false })
          .where(and(eq(chatMessages.streamId, stream.id), eq(chatMessages.isPinned, true)));
      }
      await db.update(chatMessages).set({ isPinned: next }).where(eq(chatMessages.id, target[0].id));
      await log(next ? "mesaj_sabitledi" : "sabitleme_kaldirdi", target[0].nickname);
      return Response.json({ ok: true, pinned: next });
    }
    case "clear": {
      await db
        .update(chatMessages)
        .set({ status: "deleted", isPinned: false })
        .where(eq(chatMessages.streamId, stream.id));
      await log("sohbeti_temizledi", "tüm mesajlar");
      return Response.json({ ok: true });
    }
    case "mute": {
      const minutes = body.minutes ?? DEFAULT_MUTE_MINUTES;
      await db
        .update(users)
        .set({ mutedUntil: new Date(Date.now() + minutes * 60_000) })
        .where(eq(users.id, Number(body.targetUserId)));
      await log("susturdu", `#${body.targetUserId} / ${minutes} dk`);
      return Response.json({ ok: true });
    }
    case "ban": {
      const minutes = body.minutes ?? DEFAULT_BAN_MINUTES;
      await db
        .update(users)
        .set({ bannedUntil: new Date(Date.now() + minutes * 60_000), mutedUntil: new Date(Date.now() + minutes * 60_000) })
        .where(eq(users.id, Number(body.targetUserId)));
      await db
        .update(chatMessages)
        .set({ status: "deleted" })
        .where(and(eq(chatMessages.streamId, stream.id), eq(chatMessages.userId, Number(body.targetUserId))));
      await log("uzaklastirdi", `#${body.targetUserId} / ${minutes} dk`);
      return Response.json({ ok: true });
    }
    case "unban": {
      await db
        .update(users)
        .set({ bannedUntil: null, mutedUntil: null })
        .where(eq(users.id, Number(body.targetUserId)));
      await log("yasaği_kaldiridi", `#${body.targetUserId}`);
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ ok: false, error: "Bilinmeyen işlem" }, { status: 400 });
  }
}

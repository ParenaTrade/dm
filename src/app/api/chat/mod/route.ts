import { z } from "zod";
import { db } from "@/db";
import { chatBans, chatMessages, chatRooms } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { route } from "@/lib/api";
import { HttpError, audit, requireUser } from "@/lib/auth";
import { canModerate, parseRoom } from "@/lib/chat";

const schema = z.object({
  room: z.string(),
  action: z.enum(["delete", "pin", "unpin", "ban", "slow"]),
  messageId: z.number().int().optional(),
  userId: z.string().uuid().optional(),
  minutes: z.number().int().min(0).max(60 * 24 * 365).optional(), // 0 = kalıcı
  seconds: z.number().int().min(0).max(300).optional(),
});

export const POST = route(async (req) => {
  const u = await requireUser();
  const i = schema.parse(await req.json());
  const { room, channelId } = parseRoom(i.room);
  if (!(await canModerate(u, channelId))) throw new HttpError(403, "Moderasyon yetkin yok.");
  if (i.action === "delete" && i.messageId) {
    await db.update(chatMessages).set({ deletedBy: u.id }).where(and(eq(chatMessages.id, i.messageId), eq(chatMessages.room, room)));
  } else if ((i.action === "pin" || i.action === "unpin") && i.messageId) {
    await db.update(chatMessages).set({ pinned: false }).where(eq(chatMessages.room, room));
    if (i.action === "pin") await db.update(chatMessages).set({ pinned: true }).where(and(eq(chatMessages.id, i.messageId), eq(chatMessages.room, room)));
  } else if (i.action === "ban" && i.userId) {
    const until = i.minutes ? new Date(Date.now() + i.minutes * 60e3) : null;
    await db.insert(chatBans).values({ userId: i.userId, room, until, reason: "moderasyon", byUser: u.id });
  } else if (i.action === "slow") {
    await db.insert(chatRooms).values({ room, slowModeSeconds: i.seconds ?? 0 })
      .onConflictDoUpdate({ target: chatRooms.room, set: { slowModeSeconds: i.seconds ?? 0 } });
  } else throw new HttpError(400, "Eksik parametre.");
  await audit(u.id, `chat.${i.action}`, null, i);
  return { ok: true };
});

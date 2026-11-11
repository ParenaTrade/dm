import { z } from "zod";
import { db } from "@/db";
import { chatBans, chatMessages, chatRooms, profiles } from "@/db/schema";
import { and, desc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { route } from "@/lib/api";
import { HttpError, getUser, requireUser } from "@/lib/auth";
import { bumpQuest, setting } from "@/lib/platform";
import { canModerate, parseRoom } from "@/lib/chat";

export const dynamic = "force-dynamic";

async function roomSettings(room: string) {
  const r = await db.select().from(chatRooms).where(eq(chatRooms.room, room)).limit(1);
  return r[0] ?? { room, slowModeSeconds: 0, minLevel: 3 };
}

const BANNED = ["küfür1", "küfür2", "dolandırıcı", "scam"]; // Yönetilebilir liste (örnek)
function moderate(body: string, staff: boolean) {
  let b = body.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!staff) b = b.replace(/(https?:\/\/|www\.)\S+/gi, "[link kaldırıldı]");
  for (const w of BANNED) b = b.replace(new RegExp(w, "gi"), "***");
  return b;
}

export const GET = route(async (req) => {
  const url = new URL(req.url);
  const { room, channelId } = parseRoom(url.searchParams.get("room"));
  const before = Number(url.searchParams.get("before") || 0);
  const u = await getUser();
  const rows = await db.select({
    id: chatMessages.id, body: chatMessages.body, replyTo: chatMessages.replyTo, pinned: chatMessages.pinned,
    createdAt: chatMessages.createdAt, userId: chatMessages.userId, username: profiles.username, level: profiles.level, role: profiles.role,
  }).from(chatMessages).innerJoin(profiles, eq(profiles.id, chatMessages.userId))
    .where(and(eq(chatMessages.room, room), isNull(chatMessages.deletedBy), before ? lt(chatMessages.id, before) : undefined))
    .orderBy(desc(chatMessages.id)).limit(60);
  const pinned = (await db.select({ id: chatMessages.id, body: chatMessages.body, username: profiles.username })
    .from(chatMessages).innerJoin(profiles, eq(profiles.id, chatMessages.userId))
    .where(and(eq(chatMessages.room, room), eq(chatMessages.pinned, true), isNull(chatMessages.deletedBy)))
    .orderBy(desc(chatMessages.id)).limit(1))[0];
  const settings = await roomSettings(room);
  return {
    messages: rows.reverse(),
    pinned: pinned ?? (room === "site" ? { id: 0, body: await setting("pinned_site"), username: "Sistem" } : null),
    settings,
    me: u ? { id: u.id, level: u.level, canModerate: await canModerate(u, channelId) } : null,
  };
});

const postSchema = z.object({ room: z.string(), body: z.string().min(1).max(300), replyTo: z.number().int().optional() });

export const POST = route(async (req) => {
  const u = await requireUser();
  const input = postSchema.parse(await req.json());
  const { room, channelId } = parseRoom(input.room);
  const staff = await canModerate(u, channelId);
  const settings = await roomSettings(room);
  if (!staff && u.level < settings.minLevel) throw new HttpError(403, `Mesaj için ${settings.minLevel}. seviyeye ulaş.`);
  const ban = await db.select().from(chatBans).where(and(
    eq(chatBans.userId, u.id), inArray(chatBans.room, [room, "all"]),
    or(isNull(chatBans.until), gt(chatBans.until, new Date())),
  )).limit(1);
  if (ban[0]) throw new HttpError(403, "Bu sohbette susturuldun.");
  const last = await db.select({ createdAt: chatMessages.createdAt }).from(chatMessages)
    .where(and(eq(chatMessages.userId, u.id), eq(chatMessages.room, room))).orderBy(desc(chatMessages.id)).limit(1);
  const wait = staff ? 0 : Math.max(2, settings.slowModeSeconds) * 1000;
  if (last[0] && Date.now() - last[0].createdAt.getTime() < wait) {
    throw new HttpError(429, settings.slowModeSeconds > 2 ? `Yavaş mod: ${settings.slowModeSeconds} sn bekle.` : "Çok hızlı yazıyorsun.");
  }
  const body = moderate(input.body, staff);
  if (!body) throw new HttpError(400, "Boş mesaj gönderilemez.");
  await db.insert(chatMessages).values({ room, userId: u.id, body, replyTo: input.replyTo ?? null });
  await bumpQuest(u.id, "chat_message");
  return { ok: true };
});


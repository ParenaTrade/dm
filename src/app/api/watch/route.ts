/**
 * `award-watch-time` karşılığı: izleyici her ~60 sn'de heartbeat gönderir.
 * Dakika başı 1 coin + 2 XP, günlük kanal başı en fazla 120 dk. Sadece applyCoinDelta kullanılır.
 */
import { z } from "zod";
import { db } from "@/db";
import { channels, watchPresence } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { addXp, applyCoinDelta } from "@/lib/coins";
import { bumpQuest, today } from "@/lib/platform";

const DAILY_CAP = 120;

export const POST = route(async (req) => {
  const u = await requireUser();
  const { channelId } = z.object({ channelId: z.number().int() }).parse(await req.json());
  const ch = (await db.select().from(channels).where(eq(channels.id, channelId)).limit(1))[0];
  if (!ch?.isLive || ch.ownerId === u.id) return { awarded: 0 };
  const day = today();
  const p = (await db.select().from(watchPresence).where(and(eq(watchPresence.userId, u.id), eq(watchPresence.channelId, channelId))).limit(1))[0];
  const now = new Date();
  if (!p) {
    await db.insert(watchPresence).values({ userId: u.id, channelId, day, lastSeen: now, minutesToday: 0 });
    return { awarded: 0 };
  }
  if (now.getTime() - p.lastSeen.getTime() < 55_000) return { awarded: 0 };
  const minutes = p.day === day ? p.minutesToday : 0;
  if (minutes >= DAILY_CAP) {
    await db.update(watchPresence).set({ lastSeen: now }).where(and(eq(watchPresence.userId, u.id), eq(watchPresence.channelId, channelId)));
    return { awarded: 0, capped: true };
  }
  await db.update(watchPresence).set({ lastSeen: now, day, minutesToday: minutes + 1 }).where(and(eq(watchPresence.userId, u.id), eq(watchPresence.channelId, channelId)));
  await applyCoinDelta({ userId: u.id, delta: 1, reason: "watch_time", refType: "channel", refId: channelId, idempotencyKey: `watch:${u.id}:${channelId}:${day}:${minutes + 1}` });
  await addXp(u.id, 2);
  await bumpQuest(u.id, "watch_minutes");
  return { awarded: 1 };
});

/**
 * `live-token` karşılığı. Roller:
 *  host   → yalnızca kanal sahibi, kanal askıda değil. canPublish=true (6 sa)
 *  guest  → stream_guests.status in (accepted, live). Kamera+mikrofon yayınlar (2 sa)
 *  viewer → kanal canlı olmalı; giriş yapmamışsa kısıtlı anonim kimlik (6 sa)
 */
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { channels, streamGuests } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { route, rateLimit } from "@/lib/api";
import { HttpError, audit, clientIp, getUser } from "@/lib/auth";
import { mintToken, requireLivekit } from "@/lib/livekit";

const schema = z.object({ channel: z.string().min(1).max(64), role: z.enum(["host", "guest", "viewer"]) });

export const POST = route(async (req) => {
  requireLivekit();
  const { channel: slug, role } = schema.parse(await req.json());
  rateLimit(`lk:${await clientIp()}`, 30, 60_000);
  const ch = (await db.select().from(channels).where(eq(channels.slug, slug)).limit(1))[0];
  if (!ch) throw new HttpError(404, "Kanal bulunamadı.");
  if (ch.status === "suspended") throw new HttpError(403, "Bu kanal askıya alınmış.");
  const u = await getUser();

  if (role === "host") {
    if (!u || u.id !== ch.ownerId) throw new HttpError(403, "Yalnızca kanal sahibi yayın başlatabilir.");
    await audit(u.id, "livekit.token.host", null, { channel: ch.id });
    return mintToken({ role, channelId: ch.id, identity: u.id, name: u.username });
  }
  if (role === "guest") {
    if (!u) throw new HttpError(401, "Konuk olarak katılmak için giriş yapmalısın.");
    const g = await db.select().from(streamGuests).where(and(
      eq(streamGuests.channelId, ch.id), eq(streamGuests.userId, u.id), inArray(streamGuests.status, ["accepted", "live"]),
    )).limit(1);
    if (!g[0]) throw new HttpError(403, "Bu yayın için aktif bir konuk davetin yok.");
    await audit(u.id, "livekit.token.guest", null, { channel: ch.id });
    return mintToken({ role, channelId: ch.id, identity: u.id, name: u.username });
  }
  if (!ch.isLive) throw new HttpError(409, "Yayın şu anda kapalı.");
  const identity = u ? `viewer-${u.id}` : `anon-${randomBytes(6).toString("hex")}`;
  return mintToken({ role, channelId: ch.id, identity, name: u?.username ?? "Misafir" });
});

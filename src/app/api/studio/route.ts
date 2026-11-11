/**
 * Yayıncı stüdyosu işlemleri (yalnızca kanal sahibi). `guest-manage` mantığı da buradadır.
 */
import { z } from "zod";
import { db } from "@/db";
import { channels, predictions, profiles, sponsorGames, streamEvents, streamGuests, streamSessions } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { route } from "@/lib/api";
import { HttpError, audit, requireUser } from "@/lib/auth";
import { kickParticipant, muteParticipantSource, roomName } from "@/lib/livekit";
import { notify } from "@/lib/platform";
import { settlePrediction } from "@/lib/predictions";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("go_live") }),
  z.object({ action: z.literal("end_live") }),
  z.object({ action: z.literal("update"), title: z.string().min(3).max(120).optional(), category: z.string().max(40).optional(), offlineBanner: z.string().max(120).optional(), camPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).optional() }),
  z.object({ action: z.literal("spotlight"), sponsorId: z.number().int(), minutes: z.number().int().min(1).max(30).default(5) }),
  z.object({ action: z.literal("spotlight_clear") }),
  z.object({ action: z.literal("open_game"), gameId: z.number().int() }),
  z.object({ action: z.literal("clear_game") }),
  z.object({ action: z.literal("invite"), username: z.string().min(3).max(24) }),
  z.object({ action: z.literal("approve"), guestId: z.number().int() }),
  z.object({ action: z.literal("remove"), guestId: z.number().int() }),
  z.object({ action: z.literal("mute"), guestId: z.number().int(), source: z.enum(["camera", "mic"]), muted: z.boolean() }),
  z.object({ action: z.literal("prediction_create"), title: z.string().min(5).max(140), type: z.enum(["yesno", "hunt", "range"]), options: z.array(z.string().min(1).max(40)).min(2).max(8), minutes: z.number().int().min(1).max(1440) }),
  z.object({ action: z.literal("prediction_settle"), id: z.number().int(), result: z.string().nullable() }),
]);

export const POST = route(async (req) => {
  const u = await requireUser();
  const i = schema.parse(await req.json());
  const ch = (await db.select().from(channels).where(eq(channels.ownerId, u.id)).limit(1))[0];
  if (!ch) throw new HttpError(403, "Bir kanalın yok. Admin'den yayıncı kanalı talep et.");
  if (ch.status === "suspended") throw new HttpError(403, "Kanalın askıya alınmış.");
  const event = (type: string, payload: unknown = null) => db.insert(streamEvents).values({ channelId: ch.id, type, payload });

  switch (i.action) {
    case "go_live": {
      if (ch.isLive) return { ok: true };
      await db.update(channels).set({ isLive: true, startedAt: new Date() }).where(eq(channels.id, ch.id));
      await db.insert(streamSessions).values({ channelId: ch.id, livekitRoom: roomName(ch.id) });
      await event("stream_started");
      break;
    }
    case "end_live": {
      await db.update(channels).set({ isLive: false, lastLiveAt: new Date(), activeSponsorId: null, sponsorUntil: null, currentGameId: null, viewerCount: 0 }).where(eq(channels.id, ch.id));
      await db.update(streamSessions).set({ endedAt: new Date() }).where(and(eq(streamSessions.channelId, ch.id), isNull(streamSessions.endedAt)));
      await event("stream_ended");
      break;
    }
    case "update": {
      const { action: _a, ...rest } = i; void _a;
      await db.update(channels).set(rest).where(eq(channels.id, ch.id));
      break;
    }
    case "spotlight": {
      const until = new Date(Date.now() + i.minutes * 60e3);
      await db.update(channels).set({ activeSponsorId: i.sponsorId, sponsorUntil: until }).where(eq(channels.id, ch.id));
      await event("sponsor_spotlight", { sponsorId: i.sponsorId, until });
      break;
    }
    case "spotlight_clear":
      await db.update(channels).set({ activeSponsorId: null, sponsorUntil: null }).where(eq(channels.id, ch.id));
      break;
    case "open_game": {
      const g = (await db.select().from(sponsorGames).where(eq(sponsorGames.id, i.gameId)).limit(1))[0];
      if (!g) throw new HttpError(404, "Oyun bulunamadı.");
      await db.update(channels).set({ currentGameId: g.id }).where(eq(channels.id, ch.id));
      await event("game_opened", { gameId: g.id, title: g.title });
      return { ok: true, launchUrl: g.launchUrl };
    }
    case "clear_game":
      await db.update(channels).set({ currentGameId: null }).where(eq(channels.id, ch.id));
      break;
    case "invite": {
      const target = (await db.select().from(profiles).where(eq(profiles.username, i.username.toLowerCase())).limit(1))[0];
      if (!target) throw new HttpError(404, "Kullanıcı bulunamadı.");
      if (target.id === u.id) throw new HttpError(400, "Kendini davet edemezsin.");
      const active = await db.select().from(streamGuests).where(and(eq(streamGuests.channelId, ch.id), inArray(streamGuests.status, ["invited", "accepted", "live"])));
      if (active.some((g) => g.userId === target.id)) throw new HttpError(409, "Bu kullanıcı zaten davetli.");
      if (active.length >= 3) throw new HttpError(400, "En fazla 3 konuk olabilir.");
      await db.insert(streamGuests).values({ channelId: ch.id, userId: target.id });
      await notify(target.id, "Konuk daveti", `${u.username} seni /yayin/${ch.slug} yayınına konuk olarak davet etti.`, "guest");
      await event("guest_invited", { userId: target.id });
      break;
    }
    case "approve":
    case "remove":
    case "mute": {
      const g = (await db.select().from(streamGuests).where(and(eq(streamGuests.id, i.guestId), eq(streamGuests.channelId, ch.id))).limit(1))[0];
      if (!g) throw new HttpError(404, "Konuk bulunamadı.");
      if (i.action === "approve") {
        if (g.status !== "accepted") throw new HttpError(400, "Konuk henüz daveti kabul etmedi.");
        await db.update(streamGuests).set({ status: "live" }).where(eq(streamGuests.id, g.id));
        await event("guest_join", { userId: g.userId });
      } else if (i.action === "remove") {
        await db.update(streamGuests).set({ status: "removed" }).where(eq(streamGuests.id, g.id));
        await kickParticipant(ch.id, g.userId);
        await event("guest_removed", { userId: g.userId });
      } else {
        await db.update(streamGuests).set(i.source === "camera" ? { canPublishVideo: !i.muted } : { canPublishAudio: !i.muted }).where(eq(streamGuests.id, g.id));
        await muteParticipantSource(ch.id, g.userId, i.source, i.muted);
      }
      break;
    }
    case "prediction_create": {
      await db.insert(predictions).values({ channelId: ch.id, title: i.title, type: i.type, options: i.options, closesAt: new Date(Date.now() + i.minutes * 60e3) });
      break;
    }
    case "prediction_settle": {
      const p = (await db.select().from(predictions).where(eq(predictions.id, i.id)).limit(1))[0];
      if (!p || (p.channelId !== ch.id && u.role !== "admin")) throw new HttpError(403, "Bu tahmini sonuçlandıramazsın.");
      await settlePrediction(i.id, i.result);
      break;
    }
  }
  await audit(u.id, `studio.${i.action}`, null, i);
  return { ok: true };
});

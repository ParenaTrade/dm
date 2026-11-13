import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { participants, rtcSignals, streams } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { getCurrentUser } from "@/lib/session";
import {
  getActiveStream,
  sweepStream,
  toParticipantInfo,
  toStreamInfo,
} from "@/lib/stream-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await ensureSeed();
  const user = await getCurrentUser();
  const stream = await getActiveStream();
  if (!stream) return Response.json({ ok: false, error: "Yayın bulunamadı" }, { status: 404 });

  await sweepStream(stream.id);

  const rows = await db
    .select()
    .from(participants)
    .where(eq(participants.streamId, stream.id))
    .orderBy(participants.joinedAt);

  const mine = user ? rows.find((row) => row.userId === user.id) ?? null : null;
  const liveRows = rows.filter((row) => row.status === "live");

  return Response.json({
    ok: true,
    stream: toStreamInfo(stream),
    participants: rows.map(toParticipantInfo),
    liveCount: liveRows.length,
    viewerCount: liveRows.filter((row) => row.role === "viewer").length,
    me: mine ? toParticipantInfo(mine) : null,
    user,
  });
}

type ActionBody = {
  action?: string;
  as?: string;
  code?: string;
  participantId?: number;
  patch?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

export async function POST(request: Request) {
  await ensureSeed();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Oturum gerekli" }, { status: 401 });

  const body: ActionBody = await request.json().catch(() => ({}));
  const stream = await getActiveStream();
  if (!stream) return Response.json({ ok: false, error: "Yayın bulunamadı" }, { status: 404 });

  const isHost = user.role === "host";
  const isStaff = isHost || user.role === "moderator";

  const myRows = await db
    .select()
    .from(participants)
    .where(and(eq(participants.streamId, stream.id), eq(participants.userId, user.id)))
    .limit(1);
  const mine = myRows[0] ?? null;

  switch (body.action) {
    case "join": {
      const wantGuest = body.as === "guest";
      if (wantGuest) {
        const code = (body.code ?? "").trim().toUpperCase();
        if (code !== stream.guestCode.toUpperCase()) {
          return Response.json({ ok: false, error: "Konuk kodu hatalı." }, { status: 403 });
        }
        const liveGuests = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(participants)
          .where(
            and(
              eq(participants.streamId, stream.id),
              eq(participants.role, "guest"),
              eq(participants.status, "live"),
            ),
          );
        if ((liveGuests[0]?.count ?? 0) >= stream.guestLimit) {
          return Response.json({ ok: false, error: "Konuk koltukları dolu." }, { status: 409 });
        }
      }

      const role = isHost
        ? "host"
        : wantGuest
          ? "guest"
          : user.role === "moderator"
            ? "moderator"
            : "viewer";
      const status = isHost ? "live" : wantGuest ? "waiting" : "live";

      if (mine) {
        const updated = await db
          .update(participants)
          .set({ role, status, updatedAt: new Date(), joinedAt: new Date() })
          .where(eq(participants.id, mine.id))
          .returning();
        return Response.json({ ok: true, participant: toParticipantInfo(updated[0]) });
      }

      const inserted = await db
        .insert(participants)
        .values({ streamId: stream.id, userId: user.id, nickname: user.nickname, role, status })
        .returning();
      return Response.json({ ok: true, participant: toParticipantInfo(inserted[0]) });
    }
    case "heartbeat": {
      const patch = body.patch ?? {};
      if (!mine) return Response.json({ ok: false, error: "Yayına katılmamışsın" }, { status: 400 });
      const updated = await db
        .update(participants)
        .set({
          cameraOn: typeof patch.cameraOn === "boolean" ? patch.cameraOn : mine.cameraOn,
          micOn: typeof patch.micOn === "boolean" ? patch.micOn : mine.micOn,
          handRaised: typeof patch.handRaised === "boolean" ? patch.handRaised : mine.handRaised,
          isScreenSharing:
            typeof patch.isScreenSharing === "boolean" ? patch.isScreenSharing : mine.isScreenSharing,
          status: mine.status === "removed" ? mine.status : "live",
          updatedAt: new Date(),
        })
        .where(eq(participants.id, mine.id))
        .returning();
      return Response.json({ ok: true, participant: toParticipantInfo(updated[0]) });
    }
    case "leave": {
      if (mine) {
        await db
          .update(participants)
          .set({ status: "left", cameraOn: false, micOn: false, updatedAt: new Date() })
          .where(eq(participants.id, mine.id));
      }
      return Response.json({ ok: true });
    }
    case "start": {
      if (!isHost) return Response.json({ ok: false, error: "Sadece yayıncı" }, { status: 403 });
      await db
        .update(streams)
        .set({ status: "live", startedAt: new Date(), endedAt: null, hostNickname: user.nickname })
        .where(eq(streams.id, stream.id));
      if (mine) {
        await db
          .update(participants)
          .set({ role: "host", status: "live", updatedAt: new Date() })
          .where(eq(participants.id, mine.id));
      } else {
        await db
          .insert(participants)
          .values({
            streamId: stream.id,
            userId: user.id,
            nickname: user.nickname,
            role: "host",
            status: "live",
          });
      }
      return Response.json({ ok: true });
    }
    case "stop": {
      if (!isHost) return Response.json({ ok: false, error: "Sadece yayıncı" }, { status: 403 });
      await db
        .update(streams)
        .set({ status: "idle", endedAt: new Date() })
        .where(eq(streams.id, stream.id));
      await db
        .update(participants)
        .set({ status: "left", cameraOn: false, micOn: false, updatedAt: new Date() })
        .where(eq(participants.streamId, stream.id));
      await db.delete(rtcSignals).where(eq(rtcSignals.streamId, stream.id));
      return Response.json({ ok: true });
    }
    case "settings": {
      if (!isStaff) return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });
      const s = body.settings ?? {};
      await db
        .update(streams)
        .set({
          title:
            typeof s.title === "string" && s.title.trim() ? s.title.trim().slice(0, 120) : stream.title,
          category: typeof s.category === "string" ? s.category : stream.category,
          description: typeof s.description === "string" ? s.description.slice(0, 400) : stream.description,
          guestCode:
            typeof s.guestCode === "string" && s.guestCode.trim()
              ? s.guestCode.trim().toUpperCase().slice(0, 12)
              : stream.guestCode,
          chatLocked: typeof s.chatLocked === "boolean" ? s.chatLocked : stream.chatLocked,
          slowModeSeconds:
            typeof s.slowModeSeconds === "number"
              ? Math.max(0, Math.min(120, Math.round(s.slowModeSeconds)))
              : stream.slowModeSeconds,
          guestLimit:
            typeof s.guestLimit === "number" ? Math.max(0, Math.min(6, Math.round(s.guestLimit))) : stream.guestLimit,
        })
        .where(eq(streams.id, stream.id));
      return Response.json({ ok: true });
    }
    case "admit": {
      if (!isStaff) return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });
      const updated = await db
        .update(participants)
        .set({ status: "live", updatedAt: new Date() })
        .where(and(eq(participants.id, Number(body.participantId)), eq(participants.streamId, stream.id)))
        .returning();
      return Response.json({ ok: true, participant: updated[0] ? toParticipantInfo(updated[0]) : null });
    }
    case "deny":
    case "remove": {
      if (!isStaff) return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });
      const target = await db
        .update(participants)
        .set({ status: "removed", cameraOn: false, micOn: false, updatedAt: new Date() })
        .where(and(eq(participants.id, Number(body.participantId)), eq(participants.streamId, stream.id)))
        .returning();
      if (target[0]) {
        await db.insert(rtcSignals).values({
          streamId: stream.id,
          fromUserId: user.id,
          toUserId: target[0].userId,
          kind: "bye",
          body: "",
        });
      }
      return Response.json({ ok: true });
    }
    case "muteAll": {
      if (!isStaff) return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });
      await db
        .update(participants)
        .set({ micOn: false, updatedAt: new Date() })
        .where(and(eq(participants.streamId, stream.id), ne(participants.role, "host")));
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ ok: false, error: "Bilinmeyen işlem" }, { status: 400 });
  }
}

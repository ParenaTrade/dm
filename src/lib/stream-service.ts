import { and, desc, eq, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { participants, rtcSignals, streams } from "@/db/schema";
import type { ParticipantInfo, StreamInfo } from "@/lib/types";

const STALE_MS = 60_000;

export async function getActiveStream() {
  const live = await db
    .select()
    .from(streams)
    .where(eq(streams.status, "live"))
    .orderBy(desc(streams.id))
    .limit(1);
  if (live[0]) return live[0];
  const any = await db.select().from(streams).orderBy(desc(streams.id)).limit(1);
  return any[0] ?? null;
}

export function toStreamInfo(row: typeof streams.$inferSelect): StreamInfo {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    status: row.status,
    chatLocked: row.chatLocked,
    slowModeSeconds: row.slowModeSeconds,
    guestLimit: row.guestLimit,
    hostNickname: row.hostNickname,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
  };
}

export function toParticipantInfo(row: typeof participants.$inferSelect): ParticipantInfo {
  return {
    id: row.id,
    userId: row.userId,
    nickname: row.nickname,
    role: row.role,
    status: row.status,
    cameraOn: row.cameraOn,
    micOn: row.micOn,
    handRaised: row.handRaised,
    isScreenSharing: row.isScreenSharing,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function sweepStream(streamId: number) {
  const cutoff = new Date(Date.now() - STALE_MS);
  await db
    .update(participants)
    .set({ status: "left" })
    .where(
      and(
        eq(participants.streamId, streamId),
        ne(participants.role, "host"),
        lt(participants.updatedAt, cutoff),
      ),
    );
  await db.delete(rtcSignals).where(lt(rtcSignals.createdAt, new Date(Date.now() - 45_000)));
}

export async function liveViewerCount(streamId: number) {
  const rows = await db
    .select()
    .from(participants)
    .where(and(eq(participants.streamId, streamId), eq(participants.status, "live")));
  return rows.length;
}

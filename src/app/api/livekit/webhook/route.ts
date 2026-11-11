/**
 * `stream-webhook` karşılığı. LiveKit webhook imzası (Authorization JWT) doğrulanır.
 * room_finished → yayın kapanır; participant_joined/left → izleyici sayısı + peak güncellenir.
 */
import { WebhookReceiver } from "livekit-server-sdk";
import { db } from "@/db";
import { channels, streamSessions } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireLivekit } from "@/lib/livekit";

export async function POST(req: Request) {
  let cfg;
  try { cfg = requireLivekit(); } catch { return Response.json({ error: "LiveKit yapılandırılmamış" }, { status: 503 }); }
  const body = await req.text();
  let event;
  try {
    event = await new WebhookReceiver(cfg.apiKey, cfg.apiSecret).receive(body, req.headers.get("authorization") ?? undefined);
  } catch {
    return Response.json({ error: "Geçersiz webhook imzası" }, { status: 401 });
  }
  const m = event.room?.name?.match(/^channel-(\d+)$/);
  if (!m) return Response.json({ ok: true });
  const channelId = Number(m[1]);
  const count = Math.max(0, (event.room?.numParticipants ?? 0) - 1);
  console.log(JSON.stringify({ level: "info", webhook: event.event, channelId, count }));

  if (event.event === "room_finished") {
    await db.update(channels).set({ isLive: false, viewerCount: 0, lastLiveAt: new Date() }).where(eq(channels.id, channelId));
    await db.update(streamSessions).set({ endedAt: new Date() }).where(and(eq(streamSessions.channelId, channelId), isNull(streamSessions.endedAt)));
  } else if (event.event === "participant_joined" || event.event === "participant_left") {
    await db.update(channels).set({ viewerCount: count }).where(eq(channels.id, channelId));
    await db.update(streamSessions).set({ peakViewers: sql`greatest(${streamSessions.peakViewers}, ${count})` })
      .where(and(eq(streamSessions.channelId, channelId), isNull(streamSessions.endedAt)));
  }
  return Response.json({ ok: true });
}

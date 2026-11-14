import { and, asc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { participants, rtcSignals } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { getActiveStream } from "@/lib/stream-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Sinyal kuyruğu: bana gönderilen (veya yayın geneli) sinyalleri çek ve tüket. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Oturum gerekli" }, { status: 401 });

  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? 0) || 0;

  const stream = await getActiveStream();
  if (!stream) return Response.json({ ok: true, signals: [], cursor: since });

  // Eski oturumlardan kalan bayat sinyalleri at (yenileme sonrası karışıklığı önler).
  await db.delete(rtcSignals).where(lt(rtcSignals.createdAt, new Date(Date.now() - 25_000)));

  const rows = await db
    .select()
    .from(rtcSignals)
    .where(
      and(
        eq(rtcSignals.streamId, stream.id),
        gt(rtcSignals.id, since),
        or(eq(rtcSignals.toUserId, user.id), isNull(rtcSignals.toUserId)),
      ),
    )
    .orderBy(asc(rtcSignals.id))
    .limit(120);

  const ids = rows.map((row) => row.id);
  if (ids.length) {
    await db.delete(rtcSignals).where(inArray(rtcSignals.id, ids));
  }

  return Response.json({
    ok: true,
    cursor: ids.length ? Math.max(...ids) : since,
    signals: rows.map((row) => ({
      id: row.id,
      from: row.fromUserId,
      to: row.toUserId,
      kind: row.kind,
      body: row.body,
    })),
  });
}

type OutgoingSignal = { to: number | null; kind: string; body: string };

/** Giden sinyalleri kuyruğa yaz. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Oturum gerekli" }, { status: 401 });

  const payload: { items?: OutgoingSignal[] } = await request.json().catch(() => ({}));
  const items = payload.items ?? [];
  if (!items.length) return Response.json({ ok: true, inserted: 0 });

  const stream = await getActiveStream();
  if (!stream) return Response.json({ ok: true, inserted: 0 });

  await db.insert(rtcSignals).values(
    items.slice(0, 80).map((item) => ({
      streamId: stream.id,
      fromUserId: user.id,
      toUserId: item.to ?? null,
      kind: item.kind,
      body: item.body ?? "",
    })),
  );

  return Response.json({ ok: true, inserted: items.length });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Oturum gerekli" }, { status: 401 });
  const stream = await getActiveStream();
  if (!stream) return Response.json({ ok: true });
  await db
    .select()
    .from(participants)
    .where(and(eq(participants.streamId, stream.id), eq(participants.userId, user.id)))
    .limit(1);
  return Response.json({ ok: true });
}

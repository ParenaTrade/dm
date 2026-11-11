import { db } from "@/db";
import { channels, predictions, sponsorGames, sponsors, streamEvents } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { getChannelState } from "@/lib/channelState";
import { livekitConfig } from "@/lib/env";
import StudioClient from "@/components/live/StudioClient";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const u = await getUser();
  if (!u) return <div className="p-10 text-center text-muted">Stüdyo için giriş yapmalısın.</div>;
  const ch = (await db.select().from(channels).where(eq(channels.ownerId, u.id)).limit(1))[0];
  if (!ch) return <div className="p-10 text-center text-muted">Henüz bir yayıncı kanalın yok. Admin panelinden kanal açılmasını iste.</div>;
  if (ch.status === "suspended") return <div className="p-10 text-center text-red-400">Kanalın askıya alınmış. Destek ile iletişime geç.</div>;
  const [state, sp, games, preds, events] = await Promise.all([
    getChannelState(ch.slug),
    db.select().from(sponsors).where(eq(sponsors.isActive, true)),
    db.select().from(sponsorGames).where(eq(sponsorGames.isActive, true)),
    db.select().from(predictions).where(and(eq(predictions.status, "open"))).orderBy(desc(predictions.id)),
    db.select().from(streamEvents).where(eq(streamEvents.channelId, ch.id)).orderBy(desc(streamEvents.id)).limit(12),
  ]);
  const lk = livekitConfig();
  return (
    <StudioClient
      initial={JSON.parse(JSON.stringify(state))}
      sponsors={sp.map((s) => ({ id: s.id, name: s.name, category: s.category }))}
      games={games.map((g) => ({ id: g.id, title: g.title, sponsorId: g.sponsorId }))}
      predictions={JSON.parse(JSON.stringify(preds))}
      events={JSON.parse(JSON.stringify(events))}
      livekitMissing={lk.missing}
    />
  );
}

import { db } from "@/db";
import { channels, profiles, sponsorGames, sponsors, streamGuests } from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { HttpError, getUser } from "./auth";
import { visibleSponsors, flag } from "./platform";


/** Kanal canlı durumu: geo filtreli sponsor, oyun, konuklar. API ve sayfa ortak kullanır. */
export async function getChannelState(slug: string) {
    const ch = (await db.select().from(channels).where(eq(channels.slug, slug)).limit(1))[0];
  if (!ch) throw new HttpError(404, "Kanal bulunamadı.");
  const u = await getUser();
  const sponsorsOn = await flag("sponsors_enabled");
  const visible = sponsorsOn ? await visibleSponsors() : [];
  let sponsor = null;
  if (ch.activeSponsorId && ch.sponsorUntil && ch.sponsorUntil > new Date()) {
    const s = visible.find((x) => x.id === ch.activeSponsorId);
    if (s) sponsor = { name: s.name, slug: s.slug, promoCode: s.promoCode, color: s.color, ctaText: s.ctaText, category: s.category, until: ch.sponsorUntil };
  }
  let game = null;
  if (ch.currentGameId) {
    const gr = (await db.select({ title: sponsorGames.title, sponsorId: sponsorGames.sponsorId, sponsorName: sponsors.name, slug: sponsors.slug })
      .from(sponsorGames).innerJoin(sponsors, eq(sponsors.id, sponsorGames.sponsorId)).where(eq(sponsorGames.id, ch.currentGameId)).limit(1))[0];
    if (gr) game = { title: gr.title, sponsorName: visible.some((v) => v.id === gr.sponsorId) ? gr.sponsorName : null };
  }
  const guests = await db.select({ id: streamGuests.id, userId: streamGuests.userId, status: streamGuests.status, username: profiles.username, canPublishAudio: streamGuests.canPublishAudio, canPublishVideo: streamGuests.canPublishVideo })
    .from(streamGuests).innerJoin(profiles, eq(profiles.id, streamGuests.userId))
    .where(and(eq(streamGuests.channelId, ch.id), ne(streamGuests.status, "removed")));
  const host = (await db.select({ username: profiles.username, avatarUrl: profiles.avatarUrl }).from(profiles).where(eq(profiles.id, ch.ownerId)).limit(1))[0];
  const myGuest = u ? guests.find((g) => g.userId === u.id) ?? null : null;
  return {
    channel: {
      id: ch.id, slug: ch.slug, title: ch.title, category: ch.category, isLive: ch.isLive, startedAt: ch.startedAt,
      lastLiveAt: ch.lastLiveAt, offlineBanner: ch.offlineBanner, camPosition: ch.camPosition, viewerCount: ch.viewerCount,
      status: ch.status, hostIdentity: ch.ownerId, hostName: host?.username ?? "",
    },
    sponsor, game,
    guests: guests.filter((g) => inArrayLike(g.status, ["accepted", "live"])).map((g) => ({ identity: g.userId, username: g.username, status: g.status })),
    allGuests: u?.id === ch.ownerId ? guests : undefined,
    myGuest, isOwner: u?.id === ch.ownerId, loggedIn: !!u,
  };
}

const inArrayLike = (v: string, arr: string[]) => arr.includes(v);
void inArray;

/** Sponsor yönlendirme: tıklamayı loglar (affiliate takibi), geo kuralına uymayan sponsoru engeller. */
import { db } from "@/db";
import { sponsorClicks } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { country, flag, visibleSponsors } from "@/lib/platform";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  await ensureSeed();
  const { slug } = await ctx.params;
  const cc = await country();
  const s = (await flag("sponsors_enabled")) ? (await visibleSponsors(cc)).find((x) => x.slug === slug) : undefined;
  if (!s) return new Response(null, { status: 302, headers: { Location: "/sponsors?unavailable=1" } });
  const u = await getUser();
  const ch = Number(new URL(req.url).searchParams.get("ch")) || null;
  await db.insert(sponsorClicks).values({ sponsorId: s.id, userId: u?.id ?? null, channelId: ch, country: cc });
  return new Response(null, { status: 302, headers: { Location: s.affiliateUrl, "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
}

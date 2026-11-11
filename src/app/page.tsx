import Link from "next/link";
import { db } from "@/db";
import { channels, profiles, tournaments, storeItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { Countdown, Page } from "@/components/ui";
import { flag, visibleSponsors } from "@/lib/platform";
import HeroCarousel from "@/components/HeroCarousel";

export const dynamic = "force-dynamic";

export default async function Lobby() {
  const [chs, sp, tours, storeOn, items] = await Promise.all([
    db.select({ c: channels, host: profiles.username }).from(channels).innerJoin(profiles, eq(profiles.id, channels.ownerId)).where(eq(channels.status, "active")),
    flag("sponsors_enabled").then((on) => (on ? visibleSponsors() : [])),
    db.select().from(tournaments).where(eq(tournaments.status, "active")),
    flag("store_enabled"),
    db.select().from(storeItems).where(and(eq(storeItems.isActive, true))).limit(1),
  ]);
  const main = chs[0];
  const slides = [
    { kind: "stream" as const, title: main?.c.title ?? "Cenkbey", sub: main?.c.isLive ? "Şu an CANLI – hemen katıl!" : main?.c.offlineBanner ?? "", href: main ? `/yayin/${main.c.slug}` : "/", cta: main?.c.isLive ? "Yayını izle" : "Kanala git", live: !!main?.c.isLive },
    ...sp.filter((s) => s.isFeatured).map((s) => ({ kind: "sponsor" as const, title: s.name, sub: s.description, href: `/go/${s.slug}`, cta: s.ctaText, color: s.color, live: false })),
  ];
  const daily = tours.find((t) => t.type === "daily");
  const weekly = tours.find((t) => t.type === "weekly");

  return (
    <Page>
      <HeroCarousel slides={slides} />
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <Link href="/tournaments" className="card p-5 hover:border-accent transition group">
          <div className="text-xs text-muted uppercase">Günlük turnuva</div>
          <div className="text-2xl font-black mt-1">🏆 {daily?.prizePool.toLocaleString("tr-TR")} coin</div>
          <div className="text-sm text-muted mt-1">Bitişe: {daily && <Countdown to={daily.endsAt} className="text-white" />}</div>
        </Link>
        <Link href="/tournaments" className="card p-5 hover:border-accent transition">
          <div className="text-xs text-muted uppercase">Haftalık turnuva</div>
          <div className="text-2xl font-black mt-1">👑 {weekly?.prizePool.toLocaleString("tr-TR")} coin</div>
          <div className="text-sm text-muted mt-1">Bitişe: {weekly && <Countdown to={weekly.endsAt} className="text-white" />}</div>
        </Link>
        {storeOn && items[0] ? (
          <Link href="/store" className="card p-5 hover:border-accent transition">
            <div className="text-xs text-muted uppercase">Store çekilişi</div>
            <div className="text-2xl font-black mt-1">🛍️ {items[0].title}</div>
            <div className="text-sm text-muted mt-1">Bitişe: <Countdown to={items[0].endsAt} className="text-white" /></div>
          </Link>
        ) : (
          <Link href="/quests" className="card p-5 hover:border-accent transition">
            <div className="text-xs text-muted uppercase">Günlük görevler</div>
            <div className="text-2xl font-black mt-1">🎯 Coin kazan</div>
            <div className="text-sm text-muted mt-1">İzle, sohbet et, görevleri tamamla.</div>
          </Link>
        )}
      </div>

      <h2 className="text-lg font-bold mt-8 mb-3">Kanallar</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {chs.map(({ c, host }) => (
          <Link key={c.id} href={`/yayin/${c.slug}`} className="card overflow-hidden hover:border-accent transition">
            <div className="aspect-video relative bg-cover bg-center" style={{ backgroundImage: "url(/images/hero.jpg)" }}>
              <div className="absolute inset-0 bg-black/40" />
              <span className={`absolute top-2 left-2 badge ${c.isLive ? "bg-red-600" : "bg-zinc-800"}`}>{c.isLive ? <><span className="live-dot !bg-white" /> CANLI · {c.viewerCount}</> : "OFFLINE"}</span>
            </div>
            <div className="p-3"><div className="font-semibold truncate">{c.title}</div><div className="text-xs text-muted">{host} · {c.category}</div></div>
          </Link>
        ))}
      </div>

      {sp.length > 0 && <>
        <div className="flex justify-between items-center mt-8 mb-3"><h2 className="text-lg font-bold">Sponsorlar</h2><Link href="/sponsors" className="text-sm text-accent2">Tümü →</Link></div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {sp.slice(0, 6).map((s) => <Link key={s.id} href="/sponsors" className="card p-4 text-center font-bold hover:border-accent" style={{ color: s.color }}>{s.name}</Link>)}
        </div>
      </>}
    </Page>
  );
}

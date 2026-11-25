import Image from "next/image";
import Link from "next/link";

export const NAV_ITEMS = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/izle", label: "Canlı Yayın" },
  { href: "/#program", label: "Program" },
  { href: "/sponsorlar", label: "Sponsorlar" },
  { href: "/promosyonlar", label: "Promosyonlar" },
  { href: "/oyunlar", label: "Oyunlar" },
  { href: "/maclar", label: "Maçlar" },
  { href: "/#cekilis", label: "Çekilişler" },
];

export function SiteHeader({ isLive, logoUrl, active }: { isLive: boolean; logoUrl?: string | null; active?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          {logoUrl ? (
            <Image src={logoUrl} alt="Berkbey" width={44} height={44} unoptimized className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-xl">👑</span>
          )}
          <div className="leading-none">
            <span className="font-display gold-text text-2xl">Berkbey</span>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">Oyun · Casino · Sohbet</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-white/70 lg:flex">
          {NAV_ITEMS.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`transition hover:text-gold ${active === n.href ? "text-gold" : ""}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <Link href="/izle" className="btn-gold flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold">
          <span className={isLive ? "live-dot inline-block h-2 w-2 rounded-full bg-red-600" : "inline-block h-2 w-2 rounded-full bg-red-900"} />
          CANLI YAYIN
        </Link>
      </div>

      {/* Telefon: yatay kaydırmalı menü */}
      <nav className="flex gap-2 overflow-x-auto border-t border-white/5 px-4 py-2 text-xs text-white/75 lg:hidden">
        {NAV_ITEMS.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`shrink-0 rounded-full border px-3 py-1.5 ${active === n.href ? "border-gold/60 text-gold" : "border-white/10"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";

type Promo = {
  id: number;
  title: string;
  subtitle: string;
  badge: string;
  terms: string;
  logoUrl: string;
  sponsorName: string;
  href: string;
};

/**
 * Canlı yayın ekranında dönen sponsor reklamı: marka logosu + bonus/freespin/kayıp bonusu metni.
 * Tıklayınca /go/i/{id} (tıklama sayılır) ile affiliate siteye yönlendirir. Tam ekranda da görünür.
 */
export function SponsorAdStrip({ category }: { category?: string | null }) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/promos?category=${encodeURIComponent(category ?? "")}`, { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; promos?: Promo[] };
        if (!cancelled && data.ok) setPromos(data.promos ?? []);
      } catch {
        /* sessiz geç */
      }
    };
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [category]);

  useEffect(() => {
    if (promos.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % promos.length), 9000);
    return () => clearInterval(timer);
  }, [promos.length]);

  // Gizlenen reklam 5 dk sonra geri gelir
  useEffect(() => {
    if (!hidden) return;
    const t = setTimeout(() => setHidden(false), 5 * 60_000);
    return () => clearTimeout(t);
  }, [hidden]);

  if (!promos.length || hidden) return null;
  const p = promos[index % promos.length];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-14 sm:px-20">
      <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl border border-gold/40 bg-black/75 px-3 py-2 shadow-xl shadow-black/60 backdrop-blur">
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logoUrl} alt={p.sponsorName || p.title} className="h-10 w-10 shrink-0 rounded-lg bg-white/90 object-contain p-1" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/20 font-display text-gold">
            {(p.sponsorName || p.title).slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {p.badge && (
              <span className="rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">{p.badge}</span>
            )}
            <span className="truncate text-xs font-bold text-white">{p.title}</span>
          </div>
          <p className="truncate text-[11px] text-gold">{p.subtitle || p.sponsorName}</p>
          <p className="hidden text-[9px] text-white/40 sm:block">Reklam · 18+ · Şartlar geçerlidir{p.terms ? ` — ${p.terms.slice(0, 60)}` : ""}</p>
        </div>
        <a
          href={p.href}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="btn-gold shrink-0 rounded-full px-4 py-2 text-xs font-bold"
        >
          Fırsatı Al
        </a>
        <button
          onClick={() => setHidden(true)}
          aria-label="Reklamı gizle"
          className="shrink-0 text-xs text-white/40 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

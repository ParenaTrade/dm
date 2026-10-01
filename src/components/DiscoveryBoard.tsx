"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Phone, MessageCircle, Navigation, Clock, ArrowUpRight, Search, X } from "lucide-react";
import { Pill, Rating, Stamp } from "@/components/ui";

export type DiscoveryItem = {
  slug: string;
  name: string;
  category: string;
  sectorKey: string;
  district: string;
  city: string;
  rating: number;
  reviewCount: number;
  planCode: string;
  featured: boolean;
  coverImage: string;
  description: string;
  isOpen: boolean;
  createdAt: string;
  offer: {
    title: string;
    percent: number;
    product: string;
    normalCents: number;
    dampingCents: number;
    timeStart: string | null;
    timeEnd: string | null;
    code: string;
  } | null;
  campaignTitle: string;
  campaignCount: number;
};

const FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "near", label: "Yakınımda" },
  { key: "today", label: "Bugün" },
  { key: "open", label: "Şimdi açık" },
  { key: "discount", label: "En yüksek indirim" },
  { key: "new", label: "Yeni" },
  { key: "popular", label: "Popüler" },
  { key: "restoran", label: "Restoran" },
  { key: "market", label: "Market" },
  { key: "magaza", label: "Mağaza" },
  { key: "hizmet", label: "Hizmet" },
  { key: "yapi", label: "Yapı Market" },
];

const tr = (c: number) => (c / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DiscoveryBoard({ items }: { items: DiscoveryItem[] }) {
  const [active, setActive] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = [...items];
    if (query.trim()) {
      const q = query.toLocaleLowerCase("tr-TR");
      list = list.filter(
        (i) =>
          i.name.toLocaleLowerCase("tr-TR").includes(q) ||
          i.district.toLocaleLowerCase("tr-TR").includes(q) ||
          i.description.toLocaleLowerCase("tr-TR").includes(q) ||
          (i.offer?.product ?? "").toLocaleLowerCase("tr-TR").includes(q)
      );
    }
    switch (active) {
      case "open":
        list = list.filter((i) => i.isOpen);
        break;
      case "today":
        list = list.filter((i) => !!i.offer);
        break;
      case "discount":
        list.sort((a, b) => (b.offer?.percent ?? 0) - (a.offer?.percent ?? 0));
        break;
      case "new":
        list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        break;
      case "popular":
        list.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      case "near":
        list.sort((a, b) => Number(b.featured) - Number(a.featured));
        break;
      case "restoran":
      case "market":
      case "magaza":
      case "hizmet":
      case "yapi":
        list = list.filter((i) => i.sectorKey === active);
        break;
    }
    return list;
  }, [items, active, query]);

  return (
    <div>
      {/* Arama + filtre şeridi */}
      <div className="mb-8 border-y-2 border-murekkep/15 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex min-w-[260px] flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-sicak-gri" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="İşletme, ürün veya ilçe ara — “pizza”, “Kadıköy”, “boya”…"
              className="w-full border-2 border-murekkep/15 bg-white/60 py-3 pl-10 pr-10 text-[0.92rem] placeholder:text-sicak-gri focus:border-damping focus:outline-none"
              aria-label="Arama"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 text-sicak-gri hover:text-damping"
                aria-label="Aramayı temizle"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActive(f.key)}
                className={`border-2 px-3.5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.11em] transition-colors ${
                  active === f.key
                    ? "border-damping bg-damping text-kagit"
                    : "border-murekkep/15 text-murekkep-soft hover:border-murekkep hover:text-murekkep"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[0.75rem] text-sicak-gri">
          <span className="tabular font-semibold text-murekkep">{filtered.length}</span> Damping Noktası listeleniyor
          {query ? ` · “${query}” için` : ""}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="border-2 border-dashed border-murekkep/25 p-12 text-center">
          <p className="font-display text-2xl font-bold">Bu filtreye uyan işletme yok.</p>
          <p className="mt-2 text-sm text-murekkep-soft">
            Filtreyi temizleyip yeniden deneyin veya farklı bir ilçe arayın.
          </p>
          <button
            onClick={() => {
              setActive("all");
              setQuery("");
            }}
            className="mt-5 border-2 border-murekkep px-5 py-2.5 text-[0.75rem] font-semibold uppercase tracking-[0.13em] hover:bg-murekkep hover:text-kagit"
          >
            Tümünü göster
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {filtered.map((item, idx) => (
            <article
              key={item.slug}
              className={`anim-rise group relative border-2 border-murekkep/12 bg-white/60 transition-all duration-200 hover:border-murekkep hover:shadow-[6px_6px_0_0_rgba(214,54,43,0.18)] ${
                idx === 0 && item.featured ? "lg:col-span-2" : ""
              }`}
              style={{ animationDelay: `${Math.min(idx, 8) * 45}ms` }}
            >
              <div className={`flex ${idx === 0 && item.featured ? "flex-col md:flex-row" : "flex-col sm:flex-row"}`}>
                <div
                  className={`relative shrink-0 overflow-hidden ${
                    idx === 0 && item.featured ? "h-64 md:h-auto md:w-1/2" : "h-44 sm:h-auto sm:w-40"
                  }`}
                >
                  <img
                    src={item.coverImage}
                    alt={`${item.name} — ${item.district}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-murekkep/55 via-transparent to-transparent" />
                  {item.offer ? (
                    <div className="absolute left-3 top-3 bg-damping px-2.5 py-1.5 text-center text-kagit shadow-[2px_2px_0_0_rgba(18,33,47,0.85)]">
                      <span className="tabular block text-[1.05rem] font-semibold leading-none">%{item.offer.percent}</span>
                      <span className="block text-[0.52rem] uppercase tracking-[0.16em]">damping</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-damping">
                        {item.district} · {item.category}
                      </p>
                      <h3 className="mt-1.5 font-display text-[1.28rem] font-bold leading-tight tracking-[-0.02em]">
                        <Link href={`/isletme/${item.slug}`} className="hover:text-damping">
                          {item.name}
                        </Link>
                      </h3>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Rating value={item.rating} />
                      <Pill tone={item.isOpen ? "green" : "neutral"}>
                        <Clock className="h-3 w-3" aria-hidden="true" /> {item.isOpen ? "Açık" : "Kapalı"}
                      </Pill>
                    </div>
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-[0.86rem] leading-relaxed text-murekkep-soft">
                    {item.description}
                  </p>

                  {item.offer ? (
                    <div className="mt-4 border-l-4 border-damping bg-damping-soft/45 px-4 py-3">
                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-damping-dark">
                        Bugünün dampingi{item.offer.timeStart ? ` · ${item.offer.timeStart}–${item.offer.timeEnd}` : ""}
                      </p>
                      <p className="mt-1.5 font-display text-[1.02rem] font-bold leading-snug">{item.offer.product}</p>
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3">
                        <span className="tabular text-[0.85rem] text-sicak-gri line-through">{tr(item.offer.normalCents)} TL</span>
                        <span className="tabular text-[1.15rem] font-semibold text-damping">
                          {tr(item.offer.dampingCents)} TL
                        </span>
                        <span className="border border-damping/40 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.14em] text-damping-dark">
                          {item.offer.code}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 border-l-4 border-murekkep/20 px-4 py-3 text-[0.82rem] text-murekkep-soft">
                      {item.campaignTitle || "Bu işletmede aktif damping kampanyası yakında."}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-murekkep/25 pt-3">
                    <Link
                      href={`/isletme/${item.slug}`}
                      className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-murekkep hover:text-damping"
                    >
                      İşletme sayfası <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                    <span className="text-murekkep/20">|</span>
                    <a
                      href={`tel:${item.slug.replace(/-/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-murekkep-soft hover:text-damping"
                    >
                      <Phone className="h-3.5 w-3.5" /> Ara
                    </a>
                    <span className="text-murekkep/20">|</span>
                    <a
                      href={`https://wa.me/90`}
                      className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-murekkep-soft hover:text-damping"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                    <span className="text-murekkep/20">|</span>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(item.name + " " + item.district)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-murekkep-soft hover:text-damping"
                    >
                      <Navigation className="h-3.5 w-3.5" /> Yol tarifi
                    </a>
                    {item.featured ? (
                      <span className="ml-auto">
                        <Stamp className="!rotate-0 px-2 py-1 text-[0.55rem]">Öne çıkan</Stamp>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <Link
                href={`/isletme/${item.slug}`}
                aria-label={`${item.name} işletme sayfası`}
                className="absolute inset-0"
              />
            </article>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.72rem] text-sicak-gri">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-damping" /> İstanbul · Kadıköy, Beyoğlu, Şişli
        </span>
        <span>
          <span className="tabular font-semibold text-murekkep">1.284</span> kayıtlı Damping Noktası
        </span>
        <span>
          <span className="tabular font-semibold text-murekkep">18.402</span> doğrulanmış QR satışı
        </span>
      </div>
    </div>
  );
}

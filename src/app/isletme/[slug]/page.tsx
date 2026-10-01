import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone,
  MessageCircle,
  Navigation,
  Globe,
  AtSign,
  Clock,
  MapPin,
  ArrowLeft,
  Star,
  Sparkles,
} from "lucide-react";
import { db } from "@/db";
import { analyticsEvents, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Logo, MapSketch, Pill, Rating, SectionTitle, Stamp, Btn } from "@/components/ui";
import QrOffer from "@/components/QrOffer";
import { getBusinessBySlug, getBusinessBundle } from "@/lib/queries";
import { DAY_NAMES, isOpenNow, openLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const biz = await getBusinessBySlug(slug);
  if (!biz) return { title: "İşletme bulunamadı" };
  const title = `${biz.name} — ${biz.district} ${biz.subCategory ?? biz.category} · Kampanyalar ve Damping Fırsatları`;
  const description = `${biz.name}, ${biz.district} ${biz.city}. ${biz.description ?? ""} Aktif damping kampanyaları, ürünler, çalışma saatleri ve müşteri yorumları DampingVar'da.`;
  return {
    title,
    description,
    keywords: [
      `${biz.district} ${biz.category}`,
      `${biz.district} kampanya`,
      `${biz.district} indirim`,
      `${biz.name}`,
      `${biz.subCategory ?? biz.category} ${biz.district}`,
      "Damping Noktası",
    ],
    alternates: { canonical: `/isletme/${biz.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: biz.coverImage ?? "/images/hero-vitrin.jpg", width: 1200, height: 630, alt: biz.name }],
    },
  };
}

export default async function BusinessPage({ params }: Params) {
  const { slug } = await params;
  const biz = await getBusinessBySlug(slug);
  if (!biz) notFound();

  const bundle = await getBusinessBundle(biz);
  const now = new Date();
  const open = isOpenNow(bundle.hours, now);

  await db
    .insert(analyticsEvents)
    .values({ kind: "business_view", businessId: biz.id, meta: { slug: biz.slug, source: "dijital-vitrin" } })
    .catch(() => undefined);

  const activeCampaigns = bundle.campaigns.filter((c) => c.status === "PUBLISHED");
  const featured = bundle.products.find((p) => p.discountPriceCents != null) ?? bundle.products[0] ?? null;
  const normalPrice = featured?.priceCents ?? 0;
  const dampingPrice = featured?.discountPriceCents ?? featured?.priceCents ?? 0;
  const percent = normalPrice ? Math.round((1 - dampingPrice / normalPrice) * 100) : 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: biz.name,
    description: biz.description,
    image: biz.coverImage ?? "/images/hero-vitrin.jpg",
    address: {
      "@type": "PostalAddress",
      streetAddress: biz.address,
      addressLocality: biz.district,
      addressRegion: biz.city,
      addressCountry: "TR",
    },
    telephone: biz.phone,
    aggregateRating:
      biz.reviewCount > 0
        ? { "@type": "AggregateRating", ratingValue: biz.rating, reviewCount: biz.reviewCount }
        : undefined,
    url: `/isletme/${biz.slug}`,
  };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HEADER */}
      <header className="border-b-2 border-murekkep bg-kagit">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-5 py-3.5">
          <Logo />
          <nav className="hidden items-center gap-6 text-[0.76rem] font-semibold uppercase tracking-[0.13em] md:flex">
            <a href="#firsat" className="hover:text-damping">Fırsat</a>
            <a href="#urunler" className="hover:text-damping">Ürünler</a>
            <a href="#galeri" className="hover:text-damping">Galeri</a>
            <a href="#yorumlar" className="hover:text-damping">Yorumlar</a>
            <a href="#bilgi" className="hover:text-damping">İletişim</a>
          </nav>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.13em] text-murekkep-soft hover:text-damping"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> DampingVar&apos;a dön
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative border-b-2 border-murekkep">
        <div className="relative h-[340px] w-full overflow-hidden md:h-[420px]">
          <img src={biz.coverImage ?? "/images/hero-vitrin.jpg"} alt={biz.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-murekkep via-murekkep/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-[1180px] px-5 pb-8">
              <div className="flex flex-wrap items-center gap-2.5">
                <Pill tone="damping">Damping Noktası</Pill>
                <Pill tone="ink">{biz.subCategory ?? biz.category}</Pill>
                <Pill tone={open ? "green" : "neutral"}>
                  <Clock className="h-3 w-3" /> {openLabel(bundle.hours, now)}
                </Pill>
                {biz.planCode === "BOOST" ? <Pill tone="amber">Boost görünürlük</Pill> : null}
              </div>
              <h1 className="mt-4 max-w-[18ch] font-display text-[clamp(2.2rem,6vw,4.35rem)] font-extrabold leading-[0.94] tracking-[-0.035em] text-kagit">
                {biz.name}
              </h1>
              <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-kagit/85">
                <span className="inline-flex items-center gap-1.5 text-[0.92rem]">
                  <MapPin className="h-4 w-4 text-amber" /> {biz.district}, {biz.city}
                </span>
                <Rating value={biz.rating} count={biz.reviewCount} />
                <span className="text-[0.92rem]">{biz.address}</span>
              </div>
            </div>
          </div>
        </div>

        {/* İLETİŞİM ŞERİDİ */}
        <div className="border-t-2 border-murekkep bg-kagit-2">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3 px-5 py-4">
            <a
              href={`tel:${biz.phone}`}
              className="inline-flex items-center gap-2 border-2 border-murekkep bg-murekkep px-5 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.13em] text-kagit hover:bg-murekkep-soft"
            >
              <Phone className="h-4 w-4" /> Ara
            </a>
            <a
              href={`https://wa.me/${biz.whatsapp ?? ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border-2 border-[#1f6f4a] bg-[#1f6f4a] px-5 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.13em] text-kagit hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(biz.name + " " + biz.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border-2 border-murekkep px-5 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.13em] hover:bg-murekkep hover:text-kagit"
            >
              <Navigation className="h-4 w-4" /> Yol tarifi
            </a>
            {biz.website ? (
              <a href={`https://${biz.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-2 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.13em] text-murekkep-soft hover:text-damping">
                <Globe className="h-4 w-4" /> {biz.website}
              </a>
            ) : null}
            {biz.instagram ? (
              <a href={`https://instagram.com/${biz.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-2 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.13em] text-murekkep-soft hover:text-damping">
                <AtSign className="h-4 w-4" /> @{biz.instagram}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* ANA GÖVDE */}
      <main className="mx-auto max-w-[1180px] px-5 py-14">
        <div className="grid gap-12 lg:grid-cols-[1.55fr_1fr]">
          {/* SOL: içerik */}
          <div>
            {/* BUGÜNÜN DAMPING FIRSATI */}
            <section id="firsat" className="border-2 border-damping bg-damping-soft/35">
              <div className="flex items-center justify-between gap-4 border-b-2 border-damping bg-damping px-6 py-3">
                <h2 className="font-display text-[1.02rem] font-bold uppercase tracking-[0.14em] text-kagit">
                  Bugünün damping fırsatı
                </h2>
                {activeCampaigns[0]?.timeStart ? (
                  <span className="tabular text-[0.78rem] text-kagit/90">
                    {activeCampaigns[0].timeStart}–{activeCampaigns[0].timeEnd}
                  </span>
                ) : null}
              </div>

              {featured ? (
                <div className="grid gap-6 p-6 md:grid-cols-[1.1fr_1fr]">
                  <div>
                    <p className="font-display text-[1.75rem] font-bold leading-tight">{featured.name}</p>
                    <p className="mt-2 text-[0.92rem] leading-relaxed text-murekkep-soft">{featured.description}</p>
                    <div className="mt-5 flex flex-wrap items-end gap-4">
                      <div>
                        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-sicak-gri">
                          Normal fiyat
                        </p>
                        <p className="tabular text-[1.15rem] text-sicak-gri line-through">
                          {(normalPrice / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-damping">
                          Damping fiyatı
                        </p>
                        <p className="tabular text-[2.4rem] font-semibold leading-none text-damping">
                          {(dampingPrice / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                        </p>
                      </div>
                      <div className="border-2 border-damping px-3 py-2">
                        <p className="tabular text-[1.35rem] font-semibold leading-none text-damping">%{percent}</p>
                        <p className="text-[0.56rem] uppercase tracking-[0.16em] text-damping-dark">avantaj</p>
                      </div>
                    </div>
                    <p className="mt-5 border-t border-dashed border-damping/40 pt-4 text-[0.82rem] leading-relaxed text-murekkep-soft">
                      {activeCampaigns[0]?.description ?? "Kampanya koşulları için işletme ile iletişime geçin."}
                    </p>
                  </div>

                  <div className="border-2 border-murekkep/15 bg-kagit p-5">
                    <QrOffer
                      businessId={biz.id}
                      campaignId={activeCampaigns[0]?.id ?? ""}
                      code={activeCampaigns[0]?.code ?? "DMP-000"}
                    />
                    <ul className="mt-4 space-y-2 text-[0.78rem] text-murekkep-soft">
                      <li className="flex justify-between border-b border-dashed border-murekkep/20 pb-2">
                        <span>Kampanya kodu</span>
                        <span className="tabular font-semibold text-murekkep">{activeCampaigns[0]?.code}</span>
                      </li>
                      <li className="flex justify-between border-b border-dashed border-murekkep/20 pb-2">
                        <span>Minimum sepet</span>
                        <span className="tabular font-semibold text-murekkep">
                          {((activeCampaigns[0]?.minBasketCents ?? 0) / 100).toLocaleString("tr-TR")} TL
                        </span>
                      </li>
                      <li className="flex justify-between border-b border-dashed border-murekkep/20 pb-2">
                        <span>Müşteri başına</span>
                        <span className="tabular font-semibold text-murekkep">
                          {activeCampaigns[0]?.perCustomerLimit ?? 1} kullanım
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>Geçerlilik</span>
                        <span className="font-semibold text-murekkep">
                          {activeCampaigns[0]?.endsAt
                            ? new Date(activeCampaigns[0].endsAt).toLocaleDateString("tr-TR")
                            : "Süresiz"}
                        </span>
                      </li>
                    </ul>
                    <p className="mt-4 text-[0.72rem] leading-relaxed text-sicak-gri">
                      Ödeme işletmeye yapılır. DampingVar ödeme tahsil etmez. Damping Hane ile birlikte
                      kullanılabilir; bakiye kurallarla sınırlıdır.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="p-6 text-[0.92rem] text-murekkep-soft">Bu işletmede şu an aktif damping fırsatı yok.</p>
              )}
            </section>

            {/* KAMPANYALAR */}
            {activeCampaigns.length > 0 ? (
              <section className="mt-14">
                <SectionTitle eyebrow="Aktif kampanyalar" title="Şu an geçerli DampingVar kampanyaları." />
                <div className="space-y-4">
                  {activeCampaigns.map((c) => (
                    <article key={c.id} className="border-2 border-murekkep/12 bg-white/55 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="font-display text-[1.18rem] font-bold leading-snug">{c.title}</h3>
                          <p className="mt-2 max-w-[62ch] text-[0.88rem] leading-relaxed text-murekkep-soft">
                            {c.description}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular text-[1.65rem] font-semibold leading-none text-damping">
                            {c.discountPercent > 0 ? `%${c.discountPercent}` : `${(c.discountAmountCents / 100).toFixed(0)} TL`}
                          </p>
                          <p className="tabular mt-1 text-[0.7rem] text-sicak-gri">{c.code}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-dashed border-murekkep/25 pt-3 text-[0.72rem] text-sicak-gri">
                        {c.timeStart ? (
                          <span className="tabular">
                            {c.timeStart}–{c.timeEnd}
                          </span>
                        ) : null}
                        {c.days && c.days.length ? (
                          <span>{(c.days as number[]).map((d) => DAY_NAMES[d]).join(", ")}</span>
                        ) : null}
                        <span>
                          Minimum sepet:{" "}
                          <span className="tabular">{(c.minBasketCents / 100).toLocaleString("tr-TR")} TL</span>
                        </span>
                        <span>
                          Kullanım: <span className="tabular">{c.redemptions}</span>
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ÜRÜNLER */}
            {bundle.products.length > 0 ? (
              <section id="urunler" className="mt-14">
                <SectionTitle eyebrow="Ürünler" title={`${biz.name} — öne çıkanlar.`} />
                <div className="divide-y-2 divide-murekkep/10 border-y-2 border-murekkep/15">
                  {bundle.products.map((p) => {
                    const off = p.discountPriceCents
                      ? Math.round((1 - p.discountPriceCents / p.priceCents) * 100)
                      : 0;
                    return (
                      <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                        <div className="min-w-[240px] flex-1">
                          <p className="font-display text-[1.12rem] font-bold">{p.name}</p>
                          <p className="mt-1 text-[0.85rem] text-murekkep-soft">{p.description}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {off > 0 ? (
                            <span className="border border-damping px-2 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-damping">
                              %{off} damping
                            </span>
                          ) : null}
                          <div className="text-right">
                            {p.discountPriceCents ? (
                              <p className="tabular text-[0.82rem] text-sicak-gri line-through">
                                {(p.priceCents / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                              </p>
                            ) : null}
                            <p className="tabular text-[1.25rem] font-semibold">
                              {((p.discountPriceCents ?? p.priceCents) / 100).toLocaleString("tr-TR", {
                                minimumFractionDigits: 2,
                              })}{" "}
                              TL
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* HİZMETLER */}
            {bundle.services.length > 0 ? (
              <section className="mt-14">
                <SectionTitle eyebrow="Hizmetler" title="Randevu ve hizmetler." />
                <div className="grid gap-4 sm:grid-cols-2">
                  {bundle.services.map((s) => (
                    <div key={s.id} className="border-2 border-murekkep/12 bg-white/55 p-5">
                      <p className="font-display text-[1.06rem] font-bold">{s.name}</p>
                      <p className="mt-1.5 text-[0.84rem] leading-relaxed text-murekkep-soft">{s.description}</p>
                      <div className="mt-3.5 flex items-center justify-between border-t border-dashed border-murekkep/25 pt-3">
                        <span className="text-[0.72rem] uppercase tracking-[0.13em] text-sicak-gri">
                          {s.durationMin ? `${s.durationMin} dk` : "Süresiz"}
                        </span>
                        <span className="tabular text-[1.02rem] font-semibold">
                          {s.priceCents > 0
                            ? `${(s.priceCents / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`
                            : "Ücretsiz"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* GALERİ */}
            <section id="galeri" className="mt-14">
              <SectionTitle eyebrow="Galeri" title="İşletmeden kareler." />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {bundle.media.map((m) => (
                  <figure key={m.id} className="group relative aspect-[4/3] overflow-hidden border-2 border-murekkep/12">
                    <img
                      src={m.url ?? "/images/magaza-ic.jpg"}
                      alt={m.caption ?? biz.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-murekkep/85 to-transparent px-3 py-2 text-[0.72rem] text-kagit">
                      {m.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>

            {/* YORUMLAR */}
            <section id="yorumlar" className="mt-14">
              <SectionTitle
                eyebrow="Müşteri yorumları"
                title={`${biz.reviewCount} değerlendirme, ${biz.rating.toFixed(1)} puan.`}
              />
              <div className="space-y-5">
                {bundle.reviews.map((r) => (
                  <blockquote key={r.id} className="border-l-4 border-damping bg-white/50 px-6 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-display text-[1.02rem] font-bold">{r.authorName}</p>
                      <span className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < r.rating ? "text-damping" : "text-murekkep/20"}`}
                            fill={i < r.rating ? "currentColor" : "none"}
                          />
                        ))}
                      </span>
                    </div>
                    <p className="mt-2.5 text-[0.92rem] leading-relaxed text-murekkep-soft">{r.comment}</p>
                  </blockquote>
                ))}
              </div>
            </section>

            {/* SEO / KEŞİF BANDI */}
            <section className="mt-14 border-2 border-murekkep/12 bg-kagit-2 p-6">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-damping">
                {biz.district} rehberi
              </p>
              <p className="mt-3 max-w-[75ch] text-[0.92rem] leading-relaxed text-murekkep-soft">
                <strong className="text-murekkep">{biz.name}</strong>, {biz.district} bölgesinde{" "}
                {biz.subCategory ?? biz.category} arayan müşteriler için DampingVar&apos;da listelenir.{" "}
                {biz.district} kampanyaları, {biz.district} indirimleri ve {biz.district} damping fırsatları bu
                sayfada gerçek işletme verilerinden oluşur. {biz.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  `${biz.district} ${biz.category}`,
                  `${biz.district} kampanya`,
                  `${biz.district} indirim`,
                  `${biz.subCategory ?? biz.category} ${biz.city}`,
                  "Bugün ne yenir",
                  "Yakınımdaki fırsatlar",
                ].map((t) => (
                  <span
                    key={t}
                    className="border border-murekkep/15 bg-kagit px-2.5 py-1.5 text-[0.72rem] text-murekkep-soft"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* SAĞ: işletme bilgileri */}
          <aside id="bilgi" className="lg:sticky lg:top-24 lg:self-start">
            <div className="border-2 border-murekkep">
              <div className="border-b-2 border-murekkep bg-murekkep px-5 py-3">
                <h2 className="font-display text-[0.98rem] font-bold uppercase tracking-[0.14em] text-kagit">
                  İşletme bilgileri
                </h2>
              </div>
              <div className="space-y-5 p-5">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-sicak-gri">Adres</p>
                  <p className="mt-1.5 text-[0.9rem] leading-relaxed">{biz.address}</p>
                </div>
                <MapSketch district={biz.district} city={biz.city} />

                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-sicak-gri">
                    Çalışma saatleri
                  </p>
                  <table className="mt-2.5 w-full text-[0.82rem]">
                    <tbody>
                      {bundle.hours.map((h) => (
                        <tr
                          key={h.id}
                          className={h.dayOfWeek === now.getDay() ? "font-semibold text-damping" : "text-murekkep-soft"}
                        >
                          <td className="py-1.5">{DAY_NAMES[h.dayOfWeek]}</td>
                          <td className="tabular py-1.5 text-right">
                            {h.closed ? "Kapalı" : `${h.opensAt} – ${h.closesAt}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-sicak-gri">İletişim</p>
                  <ul className="mt-2.5 space-y-2 text-[0.88rem]">
                    <li className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-damping" /> {biz.phone}
                    </li>
                    {biz.website ? (
                      <li className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-damping" /> {biz.website}
                      </li>
                    ) : null}
                    {biz.instagram ? (
                      <li className="flex items-center gap-2">
                        <AtSign className="h-3.5 w-3.5 text-damping" /> @{biz.instagram}
                      </li>
                    ) : null}
                  </ul>
                </div>

                <div className="border-t border-dashed border-murekkep/25 pt-4">
                  <p className="flex items-center gap-2 text-[0.82rem] leading-relaxed text-murekkep-soft">
                    <Sparkles className="h-4 w-4 shrink-0 text-damping" />
                    Bu sayfa DampingVar AI Pazarlama Asistanı tarafından işletme verilerinden optimize edilir.
                  </p>
                </div>

                <Btn href="/panel/kasa" variant="ink" className="w-full">
                  <QrKasaIcon /> Damping Kasa&apos;yı aç
                </Btn>
              </div>
            </div>

            <div className="mt-6 border-2 border-dashed border-damping/45 p-5">
              <Stamp>Doğrulanmış işletme</Stamp>
              <p className="mt-3.5 text-[0.85rem] leading-relaxed text-murekkep-soft">
                Bu işletmenin kampanya, satış ve komisyon verileri DampingVar tarafından doğrulanır. İşletme
                sahibi onayı olmadan hiçbir ücretli reklam yayına alınmaz.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="mt-10 border-t-2 border-murekkep bg-kagit-2">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-5 px-5 py-10">
          <Logo />
          <p className="max-w-[52ch] text-[0.82rem] leading-relaxed text-murekkep-soft">
            {biz.name} · {biz.district}, {biz.city}. Bu sayfa yalnızca DampingVar üzerinde değil, arama
            motorlarında da görünür olacak şekilde gerçek işletme verilerinden oluşturulmuştur.
          </p>
          <Link href="/" className="text-[0.76rem] font-semibold uppercase tracking-[0.13em] hover:text-damping">
            Tüm Damping Noktaları
          </Link>
        </div>
      </footer>
    </div>
  );
}

function QrKasaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="1.2" y="1.2" width="5" height="5" />
      <rect x="9.8" y="1.2" width="5" height="5" />
      <rect x="1.2" y="9.8" width="5" height="5" />
      <path d="M9.8 9.8h2.2v2.2H9.8zM12.8 12.8h2v2h-2z" />
    </svg>
  );
}

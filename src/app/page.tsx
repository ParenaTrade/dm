import Link from "next/link";
import { ArrowRight, QrCode, Sparkles, ShieldCheck, TrendingUp, Gift, MapPin } from "lucide-react";
import { db } from "@/db";
import { businessHours, businesses, campaigns, products } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Logo, SectionTitle, Stamp, StatCard, Btn, Pill, Rating } from "@/components/ui";
import DiscoveryBoard, { type DiscoveryItem } from "@/components/DiscoveryBoard";
import { ensureSeed } from "@/lib/seed";
import { isOpenNow } from "@/lib/format";

export const dynamic = "force-dynamic";

const TICKER = [
  "Kadıköy restoran kampanyaları",
  "Beyoğlu indirim",
  "Şişli kuaför dampingi",
  "Moda pizza fırsatı",
  "Kadıköy market kampanyası",
  "Bugünün dampingleri",
  "Yakınımdaki fırsatlar",
  "QR avantajı",
  "Damping Noktası",
  "Alışveriş yapmadan önce DampingVar'a bak",
];

export default async function HomePage() {
  await ensureSeed();

  const [bizRows, hourRows, campRows, prodRows] = await Promise.all([
    db.select().from(businesses).orderBy(desc(businesses.featured), desc(businesses.rating)),
    db.select().from(businessHours),
    db.select().from(campaigns),
    db.select().from(products),
  ]);

  const now = new Date();
  const items: DiscoveryItem[] = bizRows.map((b) => {
    const hours = hourRows.filter((h) => h.businessId === b.id);
    const camps = campRows.filter((c) => c.businessId === b.id && c.status === "PUBLISHED");
    const prods = prodRows.filter((p) => p.businessId === b.id && p.discountPriceCents != null);
    const p = prods[0] ?? null;
    const percent = p
      ? Math.round((1 - (p.discountPriceCents ?? 0) / p.priceCents) * 100)
      : camps[0]?.discountPercent ?? 0;
    return {
      slug: b.slug,
      name: b.name,
      category: b.category,
      sectorKey: b.sectorKey,
      district: b.district,
      city: b.city,
      rating: b.rating,
      reviewCount: b.reviewCount,
      planCode: b.planCode,
      featured: b.featured,
      coverImage: b.coverImage ?? "/images/magaza-ic.jpg",
      description: b.description ?? "",
      isOpen: isOpenNow(hours, now),
      createdAt: b.createdAt.toISOString(),
      offer:
        p && camps[0]
          ? {
              title: camps[0].title,
              percent,
              product: p.name,
              normalCents: p.priceCents,
              dampingCents: p.discountPriceCents ?? p.priceCents,
              timeStart: camps[0].timeStart,
              timeEnd: camps[0].timeEnd,
              code: camps[0].code,
            }
          : null,
      campaignTitle: camps[0]?.title ?? "",
      campaignCount: camps.length,
    };
  });

  const offers = items.filter((i) => i.offer).slice(0, 4);

  return (
    <div className="min-h-screen">
      {/* ------------------------------- HEADER ------------------------------- */}
      <header className="sticky top-0 z-50 border-b-2 border-murekkep bg-kagit/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-5 py-3.5">
          <Logo />
          <nav className="hidden items-center gap-7 text-[0.78rem] font-semibold uppercase tracking-[0.13em] lg:flex">
            <a href="#firsatlar" className="hover:text-damping">Fırsatlar</a>
            <a href="#noktalar" className="hover:text-damping">Damping Noktaları</a>
            <a href="#isletme" className="hover:text-damping">İşletmeler İçin</a>
            <Link href="/panel" className="hover:text-damping">Panel</Link>
            <Link href="/admin" className="hover:text-damping">Admin</Link>
          </nav>
          <div className="flex items-center gap-2.5">
            <Btn href="/panel" variant="outline" className="!px-4 !py-2.5 !text-[0.72rem]">Giriş</Btn>
            <Btn href="/isletme/kadikoy-pizza-atolyesi" className="!px-4 !py-2.5 !text-[0.72rem]">
              İşletmeni ekle
            </Btn>
          </div>
        </div>
      </header>

      {/* -------------------------------- HERO -------------------------------- */}
      <section className="relative overflow-hidden border-b-2 border-murekkep">
        <div className="absolute inset-0">
          <img
            src="/images/hero-vitrin.jpg"
            alt="Akşamüstü ışıklarıyla yanan mahalle esnafı vitrini"
            className="h-full w-full object-cover object-[65%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-kagit via-kagit/92 to-kagit/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-kagit via-transparent to-kagit/45" />
        </div>

        <div className="relative mx-auto grid max-w-[1240px] gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-20">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Stamp>Damping Noktası · Onaylı</Stamp>
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-murekkep-soft">
                Dijital vitrin · Kampanya · QR Kasa · Damping Hane · AI Pazarlama
              </span>
            </div>

            <h1 className="mt-7 font-display text-[clamp(2.7rem,7.2vw,5.4rem)] font-extrabold leading-[0.92] tracking-[-0.035em]">
              Alışveriş yapmadan
              <br />
              önce <span className="text-damping">DampingVar</span>
              <br />
              <span className="italic text-murekkep-soft">'a bak.</span>
            </h1>

            <p className="mt-6 max-w-[46ch] text-[1.06rem] leading-relaxed text-murekkep-soft">
              Mahallenin Damping Noktaları, gerçek QR kampanyaları ve kasada doğrulanan indirimler burada.
              Görüntülenme değil, <strong className="font-semibold text-murekkep">gerçek müşteri</strong> ölçüyoruz.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Btn href="#noktalar">
                Yakınımdaki fırsatlar <ArrowRight className="h-4 w-4" />
              </Btn>
              <Btn href="/panel/kasa" variant="outline">
                <QrCode className="h-4 w-4" /> QR Kasa'yı dene
              </Btn>
            </div>

            <dl className="mt-11 grid max-w-xl grid-cols-3 gap-px border-2 border-murekkep/15 bg-murekkep/15">
              {[
                ["1.284", "Damping Noktası"],
                ["18.402", "doğrulanmış QR satışı"],
                ["%62", "QR → gerçek müşteri"],
              ].map(([v, l]) => (
                <div key={l} className="bg-kagit px-4 py-4">
                  <dt className="tabular text-[1.42rem] font-semibold leading-none">{v}</dt>
                  <dd className="mt-1.5 text-[0.66rem] uppercase tracking-[0.14em] text-sicak-gri">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Kahraman görselin üstüne binen vitrin plaketi */}
          <div className="relative hidden lg:block">
            <div className="absolute right-2 top-2 w-[330px] rotate-[2.4deg] border-2 border-murekkep bg-kagit p-6 shadow-[10px_10px_0_0_rgba(214,54,43,0.22)]">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-damping">
                Bugünün dampingi
              </p>
              <p className="mt-2 font-display text-[1.55rem] font-bold leading-tight">
                Pizza Atölyesi Special
              </p>
              <div className="mt-3 flex items-end gap-3">
                <span className="tabular text-[1.05rem] text-sicak-gri line-through">400,00 TL</span>
                <span className="tabular text-[2.15rem] font-semibold leading-none text-damping">340,00 TL</span>
              </div>
              <div className="mt-3 border-t border-dashed border-murekkep/30 pt-3">
                <p className="tabular text-[0.72rem] text-murekkep-soft">
                  Kadıköy · Bugün geçerli · %15 avantaj
                </p>
              </div>
              <div className="mt-4 flex items-center gap-3 border-2 border-murekkep/15 p-2.5">
                <QrKare />
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em]">QR fırsatı</p>
                  <p className="tabular text-[0.82rem] font-semibold">KPA-DAMP-15</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------- TICKER ------------------------------- */}
      <div className="overflow-hidden border-b-2 border-murekkep bg-murekkep py-3">
        <div className="anim-ticker flex w-max gap-8 whitespace-nowrap">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="flex items-center gap-8 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-kagit/80">
              {t} <span className="text-damping">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ----------------------------- KEŞİF ALANI ---------------------------- */}
      <section id="noktalar" className="mx-auto max-w-[1240px] px-5 py-16">
        <SectionTitle
          eyebrow="Yakınındaki Damping Noktaları"
          title="Keşfet, karşılaştır, kasada avantajı kullan."
          note="Her işletme DampingVar'da bir dijital vitrine sahip. Kampanyalar, ürünler, çalışma saatleri ve gerçek müşteri yorumları tek sayfada."
          action={
            <div className="flex items-center gap-2">
              <Pill tone="ink"><MapPin className="h-3 w-3" /> İstanbul</Pill>
              <Pill tone="amber">Canlı veri</Pill>
            </div>
          }
        />
        <DiscoveryBoard items={items} />
      </section>

      {/* ---------------------------- BUGÜNÜN DAMPİNGLERİ --------------------- */}
      <section id="firsatlar" className="border-y-2 border-murekkep bg-kagit-2">
        <div className="mx-auto max-w-[1240px] px-5 py-16">
          <SectionTitle
            eyebrow="Bugünün Dampingleri"
            title="Bugün geçerli, kasada doğrulanan fiyatlar."
            note="Aşağıdaki fiyatlar yalnızca DampingVar QR'ı ile ve kampanya koşulları sağlandığında geçerlidir."
          />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {offers.map((o) => (
              <Link
                key={o.slug}
                href={`/isletme/${o.slug}`}
                className="anim-rise group border-2 border-murekkep bg-kagit transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(18,33,47,0.9)]"
              >
                <div className="relative h-44 overflow-hidden">
                  <img src={o.coverImage} alt={o.offer!.product} className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute right-0 top-0 bg-damping px-3 py-2 text-kagit">
                    <span className="tabular text-[1.15rem] font-semibold leading-none">%{o.offer!.percent}</span>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-damping">
                    {o.name}
                  </p>
                  <h3 className="mt-2 font-display text-[1.12rem] font-bold leading-snug">{o.offer!.product}</h3>
                  <div className="mt-3 flex items-baseline gap-2.5">
                    <span className="tabular text-[0.85rem] text-sicak-gri line-through">
                      {(o.offer!.normalCents / 100).toFixed(2)} TL
                    </span>
                    <span className="tabular text-[1.35rem] font-semibold text-damping">
                      {(o.offer!.dampingCents / 100).toFixed(2)} TL
                    </span>
                  </div>
                  <p className="mt-3 border-t border-dashed border-murekkep/30 pt-3 text-[0.72rem] text-sicak-gri">
                    {o.district}
                    {o.offer!.timeStart ? ` · ${o.offer!.timeStart}–${o.offer!.timeEnd}` : ""} ·{" "}
                    <span className="tabular">{o.offer!.code}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- GERÇEK SONUÇ ŞERİDİ ---------------------- */}
      <section className="relative overflow-hidden bg-murekkep text-kagit">
        <div className="grain-overlay absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-[1240px] px-5 py-20">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div className="max-w-[34ch]">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-amber">
                Stratejik fark
              </p>
              <h2 className="mt-4 font-display text-[clamp(2rem,4.2vw,3.35rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
                “10.000 kişi gördü” değil, <span className="text-amber">94 gerçek müşteri</span> doğrulandı.
              </h2>
              <p className="mt-5 text-[1rem] leading-relaxed text-kagit/75">
                DampingVar bir indirim sitesi değil; işletmenin internette görünmesini, müşteriye ulaşmasını ve
                hangi kampanyanın gerçekten satış getirdiğini gösteren dijital müşteri kazanım sistemidir.
              </p>
            </div>

            <div className="w-full max-w-[430px]">
              <div className="border-2 border-kagit/25 bg-kagit/[0.06] p-6">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-kagit/55">
                  Kampanya performansı · Kadıköy Pizza Atölyesi
                </p>
                <ul className="mt-5 space-y-3.5">
                  {[
                    ["8.400", "kampanya görüntülenme", "0.42"],
                    ["620", "kampanya tıklaması", "0.56"],
                    ["210", "QR üretildi", "0.68"],
                    ["94", "QR ile gerçek müşteri", "0.82"],
                    ["38.500 TL", "doğrulanan satış tutarı", "1"],
                  ].map(([v, l, w]) => (
                    <li key={l}>
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[0.82rem] text-kagit/70">{l}</span>
                        <span className="tabular text-[1.02rem] font-semibold">{v}</span>
                      </div>
                      <div className="mt-1.5 h-[3px] w-full bg-kagit/15">
                        <div className="h-full bg-amber" style={{ width: `${Number(w) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-px border border-kagit/15 bg-kagit/15 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, t: "Gerçek doğrulama", d: "Aynı QR iki kez kullanılamaz. Her işlem kasa tarafından doğrulanır." },
              { icon: TrendingUp, t: "Ölçülen dönüşüm", d: "Görüntülenmeden satışa kadar tüm zincir tek raporda." },
              { icon: Sparkles, t: "AI pazarlama", d: "28 günlük plan, kampanya önerisi, reklam varyasyonları, video senaryosu." },
              { icon: Gift, t: "Damping Hane", d: "Gerçekleşmiş işlemden havuzla karşılanan, nakit olmayan sadakat hakkı." },
            ].map((f) => (
              <div key={f.t} className="bg-murekkep p-6">
                <f.icon className="h-6 w-6 text-amber" aria-hidden="true" />
                <h3 className="mt-4 font-display text-[1.12rem] font-bold">{f.t}</h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-kagit/70">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- İŞLETME DEĞERİ ------------------------- */}
      <section id="isletme" className="mx-auto max-w-[1240px] px-5 py-20">
        <div className="grid gap-14 lg:grid-cols-2">
          <div>
            <SectionTitle
              eyebrow="İşletmeler için"
              title="Sana sadece bir profil vermiyoruz."
              note="Seni internette görünür hale getiriyoruz, kampanyanı kuruyoruz, içeriğini hazırlıyoruz, müşteriyi doğruluyoruz ve hangi kampanyanın gerçekten satış getirdiğini gösteriyoruz."
            />
            <ol className="space-y-6">
              {[
                ["01", "Damping Noktası'nı oluştur", "İşletme bilgilerin, çalışma saatlerin, ürünlerin ve fotoğraflarınla dijital vitrinin dakikalar içinde hazır."],
                ["02", "AI işletmeni analiz eder", "Sektörün, lokasyonun ve geçmiş verilerin üzerinden 28 günlük pazarlama planı ve kampanya önerileri üretir."],
                ["03", "Onaylar, yayınlarsın", "AI yalnızca taslak üretir. Kampanya, reklam ve indirim sen onaylamadan yayına girmez."],
                ["04", "QR ile gerçek müşteriyi doğrularsın", "Kasa ekranında QR okutulur, indirim ve Damping Hane hesaplanır, işlem tek adımda tamamlanır."],
                ["05", "Sonucu ölçersin", "Görüntülenme → tıklama → QR → gerçek satış. Hangi kampanyanın ne getirdiği net."],
              ].map(([n, t, d]) => (
                <li key={n} className="flex gap-5 border-b border-dashed border-murekkep/25 pb-6">
                  <span className="tabular shrink-0 text-[1.15rem] font-semibold text-damping">{n}</span>
                  <div>
                    <h3 className="font-display text-[1.22rem] font-bold leading-snug">{t}</h3>
                    <p className="mt-1.5 text-[0.92rem] leading-relaxed text-murekkep-soft">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <Btn href="/panel">İşletme panelini aç</Btn>
              <Btn href="/isletme/kadikoy-pizza-atolyesi" variant="ghost">
                Örnek dijital vitrini gör
              </Btn>
            </div>
          </div>

          <div className="space-y-6">
            <div className="relative border-2 border-murekkep">
              <img src="/images/magaza-ic.jpg" alt="Damping Noktası işletme içi" className="h-[360px] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-murekkep/70 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <Pill tone="damping">Damping Noktası</Pill>
                <p className="mt-3 font-display text-[1.45rem] font-bold leading-tight text-kagit">
                  “Müşteri arama; DampingVar müşterisinin seni bulmasını sağla.”
                </p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <StatCard label="Aylık işletme paketi" value="₺0'dan" sub="FREE · PRO · BOOST paketleri admin panelinden yönetilir." accent />
              <StatCard label="AI içerik üretimi" value="Sınırsız taslak" sub="Onay akışı olmadan hiçbir içerik yayınlanmaz." />
            </div>

            {/* Paylaş & Kazan */}
            <div className="border-2 border-damping bg-damping-soft/40 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-damping-dark">
                    Paylaş & Kazan
                  </p>
                  <h3 className="mt-2 font-display text-[1.35rem] font-bold leading-snug">
                    Davet et, gerçek alışveriş olduğunda Damping Hane kazan.
                  </h3>
                  <p className="mt-2.5 text-[0.88rem] leading-relaxed text-murekkep-soft">
                    Tek seviye. A → B kazandırır; B → C olduğunda A'ya ikinci seviye ödül oluşmaz. Ödül yalnızca
                    tamamlanmış, iade edilmemiş işlemden sonra geçerli olur.
                  </p>
                </div>
                <Stamp tone="damping" className="shrink-0">Tek seviye</Stamp>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3 border-2 border-dashed border-damping/45 bg-kagit px-4 py-3">
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-sicak-gri">
                  Referral kodun
                </span>
                <span className="tabular text-[1.18rem] font-semibold tracking-[0.12em] text-damping">
                  AHMET728
                </span>
                <span className="tabular ml-auto text-[0.78rem] text-murekkep-soft">
                  dampingvar.com/davet/AHMET728
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------- FOOTER ------------------------------ */}
      <footer className="border-t-2 border-murekkep bg-kagit-2">
        <div className="mx-auto max-w-[1240px] px-5 py-14">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Logo />
              <p className="mt-4 max-w-[38ch] text-[0.9rem] leading-relaxed text-murekkep-soft">
                Fiziksel işletmeler için dijital görünürlük, müşteri kazanımı, kampanya, QR doğrulama, sadakat ve
                AI destekli pazarlama platformu.
              </p>
              <p className="mt-5 text-[0.72rem] uppercase tracking-[0.18em] text-sicak-gri">
                Alışveriş yapmadan önce DampingVar&apos;a bak.
              </p>
            </div>
            {[
              ["Keşfet", ["Yakınımdaki Damping Noktaları", "Bugünün dampingleri", "Yeni kampanyalar", "Popüler işletmeler"]],
              ["İşletme", ["Damping Noktası ol", "Dijital vitrin", "QR Kasa", "AI pazarlama"]],
              ["Platform", ["Damping Hane kuralları", "Paylaş & Kazan", "Komisyon ve hakediş", "Gizlilik"]],
            ].map(([title, links]) => (
              <div key={title as string}>
                <h4 className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-damping">
                  {title as string}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {(links as string[]).map((l) => (
                    <li key={l}>
                      <a href="#" className="text-[0.86rem] text-murekkep-soft hover:text-damping">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t-2 border-murekkep/15 pt-6">
            <p className="text-[0.76rem] text-sicak-gri">
              © {new Date().getFullYear()} DampingVar · Ödemeler doğrudan işletmeye yapılır. Damping Hane nakit
              değildir, çekilemez.
            </p>
            <div className="flex items-center gap-2">
              <Rating value={4.7} />
              <span className="text-[0.76rem] text-sicak-gri">işletme memnuniyeti</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Elle çizilmiş QR kare motifi (dekoratif, gerçek QR üretimi panelde) */
function QrKare() {
  const cells = [
    [0, 0], [1, 0], [2, 0], [4, 0], [6, 0], [7, 0], [8, 0],
    [0, 1], [2, 1], [6, 1], [8, 1],
    [0, 2], [1, 2], [2, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2],
    [4, 3], [8, 3],
    [0, 4], [1, 4], [3, 4], [5, 4], [7, 4], [8, 4],
    [0, 5], [2, 5], [4, 5], [6, 5],
    [0, 6], [1, 6], [2, 6], [4, 6], [5, 6], [6, 6], [8, 6],
    [0, 7], [2, 7], [6, 7], [8, 7],
    [0, 8], [1, 8], [2, 8], [4, 8], [7, 8], [8, 8],
  ];
  return (
    <svg width="56" height="56" viewBox="0 0 9 9" aria-hidden="true" className="shrink-0">
      <rect width="9" height="9" fill="var(--color-kagit)" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="var(--color-murekkep)" />
      ))}
    </svg>
  );
}

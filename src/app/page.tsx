import Image from "next/image";
import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { giveaways, moderators, scheduleItems, streams } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { getSiteImages } from "@/lib/site-images";
import { listItems, listSponsors } from "@/lib/site-content";
import { LiveStudio } from "@/components/studio/LiveStudio";
import { Disclosure } from "@/components/site/Disclosure";
import { PromoGrid, SponsorGrid } from "@/components/site/ContentCards";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "🎮", title: "Oyun Yayınları", desc: "Turnuva, maraton ve chat oyunları" },
  { icon: "🎰", title: "Canlı Casino", desc: "Rulet, blackjack ve chip yarışları" },
  { icon: "💬", title: "Sohbet Keyfi", desc: "Moderatörlü, temiz ve hızlı chat" },
  { icon: "🎁", title: "Çekilişler & Hediyeler", desc: "Her yayın sonunda sürprizler" },
  { icon: "👑", title: "Berkbey Ailesi", desc: "VIP üyeler ve sadakat rozetleri" },
];

const STUDIO_FEATURES = [
  {
    title: "Yayıncı Stüdyosu",
    desc: "Kamera, mikrofon ve ekran paylaşımını tek panelden yönet. Yayını tek tuşla başlat/durdur.",
    tag: "YAYINCI",
  },
  {
    title: "Konuk Davet Sistemi",
    desc: "Kayıtlı hesap ile katılım, bekleme listesi, tek tuşla onaylama, susturma ve yayından çıkarma.",
    tag: "KONUK",
  },
  {
    title: "Moderatörlü Sohbet",
    desc: "Mesaj silme, sabitleme, susturma, uzaklaştırma, yavaş mod ve sohbet kilidi.",
    tag: "MODERASYON",
  },
  {
    title: "Gerçek Zamanlı WebRTC",
    desc: "Sinyal kuyruğu üzerinden düşük gecikmeli, kurulum gerektirmeyen p2p yayın.",
    tag: "TEKNOLOJİ",
  },
];

export default async function HomePage() {
  await ensureSeed();
  const imgs = await getSiteImages();
  const img = (slot: string) => imgs[slot]?.url ?? null;

  const [streamRow] = await db.select().from(streams).orderBy(desc(streams.id)).limit(1);
  const schedule = await db.select().from(scheduleItems).orderBy(asc(scheduleItems.orderIndex));
  const gifts = await db.select().from(giveaways).orderBy(asc(giveaways.id));
  const mods = await db.select().from(moderators).orderBy(asc(moderators.id));
  const promos = (await listItems("promo")).slice(0, 3);
  const sponsorList = await listSponsors();

  const isLive = streamRow?.status === "live";

  return (
    <div className="relative overflow-x-hidden">
      <SiteHeader isLive={isLive} logoUrl={img("logo")} />

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0">
          {img("hero") && <Image src={img("hero")!} alt="Berkbey stüdyo" fill priority unoptimized className="object-cover object-center" />}
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/60" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-14 sm:px-6 lg:pt-20">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            <span className={isLive ? "live-dot h-2.5 w-2.5 rounded-full bg-red-500" : "h-2.5 w-2.5 rounded-full bg-white/40"} />
            {isLive ? "Şimdi yayında" : "Yayın dışı — bir sonraki seansı bekle"}
          </div>

          <h1 className="font-display text-6xl leading-[0.9] sm:text-7xl lg:text-8xl">
            <span className="gold-text drop-shadow-[0_6px_30px_rgba(245,197,66,0.35)]">Berkbey</span>
          </h1>
          <p className="mt-3 font-display text-3xl text-white/90 sm:text-4xl">Birlikte Daha Eğlenceli...</p>
          <p className="mt-4 max-w-2xl text-lg text-white/65">
            Canlı oyun ve maç yayınları, moderatörlü sohbet, çekilişler ve sponsor fırsatları.
            Tek bir yerde: <span className="text-gold">Oyun · Casino · Sohbet</span>
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#canli" className="btn-gold rounded-full px-7 py-3.5 text-base font-bold">
              ▶ Canlı Yayına Katıl
            </a>
            <Link href="/promosyonlar" className="btn-ghost rounded-full px-7 py-3.5 text-base font-semibold text-white/85">
              🎁 Promosyonlar
            </Link>
            <a href="#program" className="btn-ghost rounded-full px-7 py-3.5 text-base font-semibold text-white/85">
              Yayın Programı
            </a>
          </div>
        </div>

        {/* CANLI EKRAN + SOHBET (stüdyo ekranının aynısı) */}
        <div id="canli" className="relative mx-auto max-w-7xl scroll-mt-24 px-4 pb-14 pt-6 sm:px-6">
          <LiveStudio mode="viewer" embedded posterUrl={img("banner")} />
          <div className="mt-3">
            <Disclosure compact />
          </div>
        </div>
      </section>

      {/* LIVE STRIP */}
      <div className="border-b border-white/10 bg-gradient-to-r from-violet/25 via-ink2/40 to-neon/20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm text-white/75">
            {isLive ? (
              <>
                <span className="live-dot mr-2 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
                Şu anda <span className="font-bold text-gold">{streamRow?.title}</span> yayını sürüyor — stüdyoya gir,
                sohbete katıl.
              </>
            ) : (
              <>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-white/40 align-middle" />
                Yayın şu an kapalı. Kayıt olup stüdyoyu ziyaret et ve bir sonraki seansı bekle.
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Link href="/izle" className="btn-gold rounded-full px-5 py-2 text-xs font-bold">
              Yayına Katıl
            </Link>
            <Link href="/promosyonlar" className="btn-ghost rounded-full px-5 py-2 text-xs font-semibold text-white/80">
              Promosyonlar
            </Link>
          </div>
        </div>
      </div>

      {/* MARQUEE */}
      <div className="border-y border-white/10 bg-ink2/60 py-3">
        <div className="flex w-max marquee-track gap-10 whitespace-nowrap text-sm uppercase tracking-[0.25em] text-white/40">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex gap-10">
              {["Canlı yayın", "Konuk programı", "Moderatörlü sohbet", "Çekiliş", "Turnuva", "VIP üyelik", "Casino keyfi", "Gold rozet"].map((t) => (
                <span key={t} className="flex items-center gap-10">
                  <span>{t}</span>
                  <span className="text-gold">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* SPONSOR FIRSATLARI */}
      {(promos.length > 0 || sponsorList.length > 0) && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-4xl">Sponsor Fırsatları</h2>
              <p className="mt-2 text-white/60">Bonus, freespin ve kayıp bonusu kampanyaları. Şartlar kartlarda yazılıdır.</p>
            </div>
            <Link href="/promosyonlar" className="btn-ghost rounded-full px-5 py-2.5 text-sm font-semibold">
              Tüm promosyonlar →
            </Link>
          </div>
          {promos.length > 0 && (
            <div className="mt-8">
              <PromoGrid items={promos} />
            </div>
          )}
          {sponsorList.length > 0 && (
            <div className="mt-10">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-white/40">İş ortaklarımız</p>
              <SponsorGrid items={sponsorList.slice(0, 6)} />
            </div>
          )}
        </section>
      )}

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-4xl">Neler Var?</h2>
        <p className="mt-2 text-white/60">Berkbey ekosisteminin beş ana kolu.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass group rounded-3xl p-5 transition hover:border-gold/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet/40 to-gold/20 text-2xl">
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-white/55">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STUDIO */}
      <section className="relative py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet/30 to-ink2">
              {img("studio") && <Image src={img("studio")!} alt="Stüdyo" fill unoptimized className="object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <p className="font-display text-2xl text-gold">Yayıncı + Konuk Stüdyosu</p>
                <p className="text-sm text-white/70">WebRTC tabanlı gerçek canlı yayın altyapısı</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {STUDIO_FEATURES.map((s) => (
                <div key={s.title} className="glass-dark rounded-3xl p-5">
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-gold">
                    {s.tag}
                  </span>
                  <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-white/55">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAM */}
      <section id="program" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-4xl">Yayın Programı</h2>
            <p className="mt-2 text-white/60">Haftanın hangi günü neredeyiz?</p>
          </div>
          <Link href="/izle" className="btn-ghost rounded-full px-5 py-2.5 text-sm font-semibold">
            Hatırlatıcı kur →
          </Link>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {schedule.map((item) => (
            <div
              key={item.id}
              className="glass flex items-center gap-4 rounded-2xl p-4 transition hover:border-gold/40"
            >
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-violet/50 to-ink3">
                <span className="font-display text-lg text-gold">{item.time}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/50">{item.day.slice(0, 3)}</span>
              </div>
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-white/50">
                  {item.day} · {item.category}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ÇEKİLİŞ */}
      <section id="cekilis" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="font-display text-4xl">Çekilişler & Hediyeler</h2>
            <p className="mt-2 text-white/60">Her yayın sonunda canlı çekiliş. Katılmak için sohbete yazman yeterli.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {gifts.map((g) => (
                <div key={g.id} className="glass-dark rounded-3xl p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🎁</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        g.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50"
                      }`}
                    >
                      {g.status === "active" ? "Katılım açık" : "Sonuçlandı"}
                    </span>
                  </div>
                  <h3 className="mt-3 font-bold">{g.title}</h3>
                  <p className="text-sm text-gold">{g.prize}</p>
                  <p className="mt-2 text-xs text-white/45">
                    {g.status === "active" ? `${g.entries.toLocaleString("tr-TR")} katılımcı` : `Kazanan: ${g.winner}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[260px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet/30 to-ink2">
            {img("casino") && <Image src={img("casino")!} alt="Canlı casino" fill unoptimized className="object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <p className="font-display text-3xl gold-text">Canlı Casino Keyfi</p>
              <p className="mt-1 text-sm text-white/70">Rulet turu, chip yarışı ve masa oyunları — her akşam stüdyoda.</p>
            </div>
          </div>
        </div>
      </section>

      {/* AİLE */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet/30 to-ink2">
          {img("community") && <Image src={img("community")!} alt="Berkbey ailesi" fill unoptimized className="object-cover" />}
          <div className="absolute inset-0 bg-ink/70" />
          <div className="relative px-6 py-14 text-center">
            <h2 className="font-display text-5xl gold-text">Takip Et, Ailemize Katıl!</h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/70">
              Moderatör ekibiyle güvenli bir sohbet ortamı, VIP rozetleri ve sürpriz konuklar.
              Stüdyoya gir, adını yaz, sohbete katıl.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/izle" className="btn-gold rounded-full px-7 py-3 font-bold">
                Canlı Yayına Katıl
              </Link>
              <Link href="/promosyonlar" className="btn-ghost rounded-full px-7 py-3 font-semibold text-white/85">
                Promosyonlar
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {mods.map((m) => (
                <span key={m.id} className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                  🛡 {m.nickname}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

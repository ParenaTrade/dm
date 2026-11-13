import Image from "next/image";
import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { giveaways, moderators, scheduleItems, streams } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";

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
    desc: "Konuk kodu ile katılım, bekleme listesi, tek tuşla onaylama, susturma ve yayından çıkarma.",
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

function formatTime(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "long" }).format(date);
}

export default async function HomePage() {
  await ensureSeed();

  const [streamRow] = await db.select().from(streams).orderBy(desc(streams.id)).limit(1);
  const schedule = await db.select().from(scheduleItems).orderBy(asc(scheduleItems.orderIndex));
  const gifts = await db.select().from(giveaways).orderBy(asc(giveaways.id));
  const mods = await db.select().from(moderators).orderBy(asc(moderators.id));

  const isLive = streamRow?.status === "live";

  return (
    <div className="relative overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="Berkbey" width={44} height={44} className="rounded-xl" />
            <div className="leading-none">
              <span className="font-display gold-text text-2xl">Berkbey</span>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">Oyun · Casino · Sohbet</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-white/70 lg:flex">
            <Link className="transition hover:text-gold" href="/">Ana Sayfa</Link>
            <Link className="transition hover:text-gold" href="/canli">Canlı Yayın</Link>
            <a className="transition hover:text-gold" href="#program">Program</a>
            <a className="transition hover:text-gold" href="#cekilis">Çekilişler</a>
            <Link className="transition hover:text-gold" href="/panel">Moderatör Paneli</Link>
            <Link className="transition hover:text-gold" href="/durum">Sistem Durumu</Link>
          </nav>

          <Link
            href="/canli"
            className="btn-gold flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
          >
            <span className={isLive ? "live-dot inline-block h-2 w-2 rounded-full bg-red-600" : "inline-block h-2 w-2 rounded-full bg-red-900"} />
            CANLI YAYIN
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0">
          <Image src="/images/hero.jpg" alt="Berkbey stüdyo" fill priority className="object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/60" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              <span className={isLive ? "live-dot h-2.5 w-2.5 rounded-full bg-red-500" : "h-2.5 w-2.5 rounded-full bg-white/40"} />
              {isLive ? "Şimdi yayında" : "Yayın dışı — bir sonraki seansı bekle"}
            </div>

            <h1 className="font-display text-6xl leading-[0.9] sm:text-7xl lg:text-8xl">
              <span className="gold-text drop-shadow-[0_6px_30px_rgba(245,197,66,0.35)]">Berkbey</span>
            </h1>
            <p className="mt-3 font-display text-3xl text-white/90 sm:text-4xl">
              Birlikte Daha Eğlenceli...
            </p>
            <p className="mt-4 max-w-xl text-lg text-white/65">
              Canlı yayın stüdyosu, konuk programları, moderatörlü sohbet, çekilişler ve turnuvalar.
              Tek bir yerde: <span className="text-gold">Oyun · Casino · Sohbet</span>
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/canli" className="btn-gold rounded-full px-7 py-3.5 text-base font-bold">
                ▶ Stüdyoya Gir
              </Link>
              <a href="#program" className="btn-ghost rounded-full px-7 py-3.5 text-base font-semibold text-white/85">
                Yayın Programı
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4 text-white/60">
              {["YouTube", "Twitch", "Kick", "Instagram", "TikTok", "Discord"].map((s) => (
                <span key={s} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* LIVE CARD */}
          <div className="glass neon-ring float-slow self-center rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold tracking-wider">
                {isLive ? "● CANLI" : "○ ÇEVRİMDIŞI"}
              </span>
              <span className="text-xs text-white/50">{streamRow?.category ?? "Sohbet"}</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold leading-snug">
              {streamRow?.title ?? "Berkbey ile Canlı Sohbet"}
            </h2>
            <p className="mt-2 text-sm text-white/60">{streamRow?.description}</p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="font-display text-2xl text-gold">{mods.length}</p>
                <p className="text-[11px] uppercase tracking-wider text-white/50">Moderatör</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="font-display text-2xl text-gold">{streamRow?.guestLimit ?? 3}</p>
                <p className="text-[11px] uppercase tracking-wider text-white/50">Konuk Koltuğu</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="font-display text-2xl text-gold">{schedule.length}</p>
                <p className="text-[11px] uppercase tracking-wider text-white/50">Haftalık Seans</p>
              </div>
            </div>

            <p className="mt-5 text-xs text-white/40">
              {isLive && streamRow?.startedAt
                ? `Yayın ${formatTime(streamRow.startedAt)} itibarıyla sürüyor · Konuk kodu: ${streamRow.guestCode}`
                : `Sonraki konuk kodu: ${streamRow?.guestCode ?? "BERK24"} · Stüdyodan takip et`}
            </p>

            <Link
              href="/canli"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-semibold transition hover:bg-white/20"
            >
              Yayını izle / konuk ol →
            </Link>
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
                Yayın şu an kapalı. Stüdyoyu ziyaret et, bir sonraki seansı bekle; konuk kodu{" "}
                <span className="font-bold text-gold">{streamRow?.guestCode}</span>
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Link href="/canli" className="btn-gold rounded-full px-5 py-2 text-xs font-bold">
              Yayına Katıl
            </Link>
            <Link href="/panel" className="btn-ghost rounded-full px-5 py-2 text-xs font-semibold text-white/80">
              Moderatör Paneli
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
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10">
              <Image src="/images/studio.jpg" alt="Stüdyo" fill className="object-cover" />
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
          <Link href="/canli" className="btn-ghost rounded-full px-5 py-2.5 text-sm font-semibold">
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
          <div className="relative overflow-hidden rounded-3xl border border-white/10">
            <Image src="/images/casino.jpg" alt="Canlı casino" fill className="object-cover" />
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
        <div className="relative overflow-hidden rounded-3xl border border-white/10">
          <Image src="/images/community.jpg" alt="Berkbey ailesi" fill className="object-cover" />
          <div className="absolute inset-0 bg-ink/70" />
          <div className="relative px-6 py-14 text-center">
            <h2 className="font-display text-5xl gold-text">Takip Et, Ailemize Katıl!</h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/70">
              Moderatör ekibiyle güvenli bir sohbet ortamı, VIP rozetleri ve sürpriz konuklar.
              Stüdyoya gir, adını yaz, sohbete katıl.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/canli" className="btn-gold rounded-full px-7 py-3 font-bold">
                Canlı Yayına Katıl
              </Link>
              <Link href="/panel" className="btn-ghost rounded-full px-7 py-3 font-semibold text-white/85">
                Moderatör Paneli
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

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-ink2/70">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div>
            <p className="font-display gold-text text-3xl">Berkbey</p>
            <p className="mt-2 text-sm text-white/50">
              Oyun · Casino · Sohbet. Berkbey ile her yayın daha özel.
            </p>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-wider text-gold">Platform</p>
            <ul className="space-y-2 text-sm text-white/60">
              <li><Link href="/canli" className="hover:text-gold">Canlı Yayın Stüdyosu</Link></li>
              <li><Link href="/panel" className="hover:text-gold">Moderatör Paneli</Link></li>
              <li><Link href="/durum" className="hover:text-gold">Sistem &amp; Deployment Durumu</Link></li>
              <li><a href="#program" className="hover:text-gold">Yayın Programı</a></li>
              <li><a href="#cekilis" className="hover:text-gold">Çekilişler</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-wider text-gold">Sosyal</p>
            <ul className="space-y-2 text-sm text-white/60">
              {["YouTube", "Twitch", "Kick", "Instagram", "TikTok", "Discord"].map((s) => (
                <li key={s} className="hover:text-gold">{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-wider text-gold">Bilgi</p>
            <p className="text-sm text-white/50">
              Bu site bir demo yayın platformudur. Yayın altyapısı tarayıcılar arası WebRTC ile çalışır.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">
          © {new Date().getFullYear()} Berkbey — Tüm hakları saklıdır.
        </div>
      </footer>
    </div>
  );
}

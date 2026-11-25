import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-ink2/70">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <p className="font-display gold-text text-3xl">Berkbey</p>
          <p className="mt-2 text-sm text-white/50">Oyun · Casino · Sohbet. Berkbey ile her yayın daha özel.</p>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-gold">Menü</p>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link href="/izle" className="hover:text-gold">Canlı Yayın</Link></li>
            <li><Link href="/sponsorlar" className="hover:text-gold">Sponsorlar</Link></li>
            <li><Link href="/promosyonlar" className="hover:text-gold">Promosyonlar</Link></li>
            <li><Link href="/oyunlar" className="hover:text-gold">Oyunlar</Link></li>
            <li><Link href="/maclar" className="hover:text-gold">Maçlar</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-gold">Sosyal</p>
          <ul className="space-y-2 text-sm text-white/60">
            {["YouTube", "Twitch", "Kick", "Instagram", "TikTok", "Discord"].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-gold">Bilgi</p>
          <p className="text-sm text-white/50">
            Sitedeki sponsor bağlantıları iş ortaklığı (affiliate) bağlantısıdır; üyelik ve işlemlerden komisyon
            kazanabiliriz. Yalnızca 18 yaş üstü içindir.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Berkbey — Tüm hakları saklıdır.
        <Link href="/panel" className="ml-3 text-white/25 hover:text-gold">Yönetim</Link>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { Disclosure } from "./Disclosure";

export type SponsorCard = { id: number; name: string; description: string; logoUrl: string };
export type ItemCard = {
  id: number;
  title: string;
  subtitle: string;
  body: string;
  imageUrl: string;
  badge: string;
  terms: string;
  startsAt: Date | null;
  hasLink: boolean;
  sponsorName: string;
  sponsorLogo: string;
};

const ext = "sponsored nofollow noopener noreferrer";

function Logo({ src, name, size = "h-14 w-14" }: { src: string; name: string; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className={`${size} shrink-0 rounded-2xl bg-white/90 object-contain p-1.5`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet/50 to-gold/30 font-display text-xl text-gold`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function SponsorGrid({ items }: { items: SponsorCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <div key={s.id} className="glass flex flex-col rounded-3xl p-5 transition hover:border-gold/40">
          <div className="flex items-center gap-4">
            <Logo src={s.logoUrl} name={s.name} size="h-16 w-16" />
            <h3 className="text-xl font-bold">{s.name}</h3>
          </div>
          {s.description && <p className="mt-3 flex-1 text-sm text-white/60">{s.description}</p>}
          <a
            href={`/go/s/${s.id}?p=sponsors`}
            target="_blank"
            rel={ext}
            className="btn-gold mt-5 rounded-full px-5 py-2.5 text-center text-sm font-bold"
          >
            Siteye Git →
          </a>
        </div>
      ))}
    </div>
  );
}

export function PromoGrid({ items }: { items: ItemCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <div key={p.id} className="glass neon-ring flex flex-col rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <Logo src={p.sponsorLogo || p.imageUrl} name={p.sponsorName || p.title} />
            {p.badge && (
              <span className="rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold">
                {p.badge}
              </span>
            )}
          </div>
          {p.sponsorName && <p className="mt-3 text-xs uppercase tracking-wider text-white/45">{p.sponsorName}</p>}
          <h3 className="mt-1 text-xl font-bold leading-snug">{p.title}</h3>
          {p.subtitle && <p className="mt-1 font-display text-2xl text-gold">{p.subtitle}</p>}
          {p.body && <p className="mt-2 text-sm text-white/60">{p.body}</p>}
          {p.terms && <p className="mt-3 text-[11px] leading-relaxed text-white/40">Şartlar: {p.terms}</p>}
          <div className="flex-1" />
          {p.hasLink && (
            <a
              href={`/go/i/${p.id}?p=promo`}
              target="_blank"
              rel={ext}
              className="btn-gold mt-5 rounded-full px-5 py-3 text-center text-sm font-bold"
            >
              Fırsatı Al →
            </a>
          )}
          <div className="mt-3">
            <Disclosure compact />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GameGrid({ items }: { items: ItemCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((g) => (
        <div key={g.id} className="glass group flex flex-col overflow-hidden rounded-3xl transition hover:border-gold/40">
          <div className="relative aspect-[4/3] bg-gradient-to-br from-violet/40 to-ink2">
            {g.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.imageUrl} alt={g.title} className="h-full w-full object-cover transition group-hover:scale-105" />
            )}
            {g.badge && (
              <span className="absolute left-3 top-3 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase text-black">
                {g.badge}
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-col p-4">
            <h3 className="font-bold">{g.title}</h3>
            {g.subtitle && <p className="text-xs text-gold">{g.subtitle}</p>}
            {g.body && <p className="mt-2 text-xs text-white/55">{g.body}</p>}
            <div className="flex-1" />
            {g.hasLink && (
              <a
                href={`/go/i/${g.id}?p=game`}
                target="_blank"
                rel={ext}
                className="btn-ghost mt-4 rounded-full px-4 py-2 text-center text-sm font-semibold"
              >
                Oyna →
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function when(date: Date | null) {
  if (!date) return { text: "Saat açıklanacak", soon: false };
  const text = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "long",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const diff = date.getTime() - Date.now();
  return { text, soon: diff < 0 && diff > -2 * 3600_000 };
}

export function MatchList({ items }: { items: ItemCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((m) => {
        const t = when(m.startsAt);
        return (
          <div key={m.id} className="glass flex flex-col gap-3 rounded-3xl p-5 sm:flex-row sm:items-center">
            <div className="flex h-16 min-w-[88px] flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-violet/50 to-ink3 px-3 text-center">
              <span className="text-[11px] font-semibold leading-tight text-gold">{t.text}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {t.soon && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold">● CANLI</span>}
                {m.badge && <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-gold">{m.badge}</span>}
              </div>
              <h3 className="mt-1 text-lg font-bold leading-snug">{m.title}</h3>
              {m.subtitle && <p className="text-xs text-white/50">{m.subtitle}</p>}
              {m.body && <p className="mt-1 text-sm text-white/55">{m.body}</p>}
            </div>
            {m.hasLink && (
              <a
                href={`/go/i/${m.id}?p=match`}
                target="_blank"
                rel={ext}
                className="btn-gold shrink-0 rounded-full px-5 py-2.5 text-center text-sm font-bold"
              >
                Maç Fırsatı →
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="glass rounded-3xl p-10 text-center text-white/55">
      {text}
      <div className="mt-4">
        <Link href="/izle" className="btn-ghost rounded-full px-5 py-2 text-sm">Canlı yayına git</Link>
      </div>
    </div>
  );
}

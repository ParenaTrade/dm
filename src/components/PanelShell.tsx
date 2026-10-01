import Link from "next/link";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Store,
  Megaphone,
  QrCode,
  Sparkles,
  CalendarDays,
  BarChart3,
  Users,
  Wallet,
  Receipt,
  Settings,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Logo, Pill } from "@/components/ui";
import type { PanelContext } from "@/lib/panel";

const NAV = [
  { key: "genel", label: "Genel Bakış", path: "/panel", icon: LayoutDashboard },
  { key: "vitrin", label: "Dijital Vitrin", path: "/panel/vitrin", icon: Store },
  { key: "kampanyalar", label: "Kampanyalar", path: "/panel/kampanyalar", icon: Megaphone },
  { key: "kasa", label: "Damping Kasa", path: "/panel/kasa", icon: QrCode },
  { key: "ai", label: "AI Pazarlama", path: "/panel/ai", icon: Sparkles },
  { key: "plan", label: "Pazarlama Takvimi", path: "/panel/plan", icon: CalendarDays },
  { key: "performans", label: "Performans", path: "/panel/performans", icon: BarChart3 },
  { key: "musteriler", label: "Müşteriler", path: "/panel/musteriler", icon: Users },
  { key: "hane", label: "Damping Hane", path: "/panel/damping-hane", icon: Wallet },
  { key: "hakedis", label: "Hakediş / Komisyon", path: "/panel/hakedis", icon: Receipt },
  { key: "ayarlar", label: "Ayarlar", path: "/panel/ayarlar", icon: Settings },
];

export default function PanelShell({
  ctx,
  active,
  children,
  businesses = [],
}: {
  ctx: PanelContext;
  active: string;
  children: ReactNode;
  businesses?: { slug: string; name: string }[];
}) {
  const q = `biz=${encodeURIComponent(ctx.slug)}&rol=${ctx.role}`;

  return (
    <div className="min-h-screen">
      {/* Üst mühür bandı */}
      <div className="border-b-2 border-murekkep bg-damping">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-2">
          <p className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-kagit">
            DampingVar İşletme Paneli · Damping Noktası
          </p>
          <p className="text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-kagit/85">
            {ctx.actorName} · {ctx.role === "OWNER" ? "İşletme Sahibi" : ctx.role === "MANAGER" ? "Yönetici" : "Kasiyer"}
          </p>
        </div>
      </div>

      <header className="border-b-2 border-murekkep bg-kagit">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-5">
            <Logo />
            <div className="hidden border-l-2 border-murekkep/15 pl-5 md:block">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-sicak-gri">
                Aktif işletme
              </p>
              <p className="font-display text-[1.02rem] font-bold leading-tight">{ctx.biz.name}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {businesses.length > 1 ? (
              <div className="hidden items-center gap-1.5 xl:flex">
                {businesses.slice(0, 5).map((b) => (
                  <Link
                    key={b.slug}
                    href={`${b.slug === ctx.slug ? "/panel" : "/panel"}?biz=${encodeURIComponent(b.slug)}&rol=${ctx.role}`}
                    className={`border px-2.5 py-1.5 text-[0.68rem] font-semibold ${
                      b.slug === ctx.slug
                        ? "border-damping bg-damping text-kagit"
                        : "border-murekkep/20 text-murekkep-soft hover:border-murekkep"
                    }`}
                  >
                    {b.name.split(" ")[0]}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-1.5 border-2 border-murekkep/15 p-1">
              {["OWNER", "MANAGER", "CASHIER"].map((r) => (
                <Link
                  key={r}
                  href={`${NAV.find((n) => n.key === active)?.path ?? "/panel"}?biz=${encodeURIComponent(
                    ctx.slug
                  )}&rol=${r}`}
                  className={`px-2.5 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.11em] ${
                    ctx.role === r ? "bg-murekkep text-kagit" : "text-murekkep-soft hover:text-damping"
                  }`}
                >
                  {r === "OWNER" ? "Sahip" : r === "MANAGER" ? "Yönetici" : "Kasiyer"}
                </Link>
              ))}
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-murekkep-soft hover:text-damping"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Siteye dön
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-5 py-8 lg:flex-row">
        {/* Sol evrak sekmeleri */}
        <nav className="lg:w-[232px] lg:shrink-0">
          <ul className="flex gap-2 overflow-x-auto pb-2 thin-scroll lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV.map((item) => {
              const isActive = item.key === active;
              return (
                <li key={item.key} className="lg:w-full">
                  <Link
                    href={`${item.path}?${q}`}
                    className={`flex items-center gap-2.5 whitespace-nowrap border-2 px-3.5 py-2.5 text-[0.76rem] font-semibold transition-all ${
                      isActive
                        ? "border-murekkep bg-murekkep text-kagit shadow-[3px_3px_0_0_rgba(214,54,43,0.85)]"
                        : "border-transparent text-murekkep-soft hover:border-murekkep/20 hover:bg-kagit-2 hover:text-murekkep"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-amber" : ""}`} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 hidden border-2 border-dashed border-damping/40 p-4 lg:block">
            <Pill tone="damping">Kasa yardımı</Pill>
            <p className="mt-3 text-[0.76rem] leading-relaxed text-murekkep-soft">
              Kasiyer akışı: <strong className="text-murekkep">QR → Tutar → İndirim → Ödeme → Tamamla</strong>.
              Komisyon oranları kasiyer tarafından değiştirilemez.
            </p>
            <Link
              href={`/panel/kasa?${q}`}
              className="mt-3 inline-flex items-center gap-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-damping hover:underline"
            >
              Kasa ekranına git <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

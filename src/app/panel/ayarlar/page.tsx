import PanelShell from "@/components/PanelShell";
import { panelContext } from "@/lib/panel";
import { getBusinessBundle, getBusinesses } from "@/lib/queries";
import { Pill, SectionTitle, StatCard, Stamp } from "@/components/ui";
import { db } from "@/db";
import { aiSettings, packages } from "@/db/schema";
import { fmtTL } from "@/lib/format";
import { Check, Lock, Sparkles, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AyarlarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [bundle, allBiz, pkgRows, aiRows] = await Promise.all([
    getBusinessBundle(ctx.biz),
    getBusinesses(),
    db.select().from(packages),
    db.select().from(aiSettings),
  ]);

  return (
    <PanelShell ctx={ctx} active="ayarlar" businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}>
      <SectionTitle
        eyebrow="Ayarlar"
        title="Sözleşme, personel ve paket."
        note="Finansal ayarlar sunucuda saklanır ve kasiyer rolü tarafından değiştirilemez."
        action={
          <Pill tone="ink">
            <Lock className="h-3 w-3" /> {ctx.role}
          </Pill>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Paket" value={ctx.biz.planCode} sub="Aylık yenilenir" accent />
        <StatCard label="Komisyon oranı" value="%6,0" sub="AFTER_DAMPING tabanı" />
        <StatCard label="Personel" value={String(bundle.staff.length)} sub="Panel erişimi olan" />
        <StatCard label="AI kotası" value="120/ay" sub="İçerik üretim hakkı" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Personel */}
        <div className="border-2 border-murekkep/12 bg-white/55">
          <div className="flex items-center gap-2 border-b-2 border-murekkep/12 px-5 py-3.5">
            <Users className="h-4 w-4 text-damping" />
            <h2 className="font-display text-[1.08rem] font-bold">Personel ve roller</h2>
          </div>
          <ul>
            {bundle.staff.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-murekkep/10 px-5 py-3.5 last:border-0">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-[0.76rem] text-sicak-gri">{s.email}</p>
                </div>
                <Pill tone={s.role === "OWNER" ? "damping" : s.role === "MANAGER" ? "ink" : "neutral"}>
                  {s.role === "OWNER" ? "İşletme sahibi" : s.role === "MANAGER" ? "Yönetici" : "Kasiyer"}
                </Pill>
              </li>
            ))}
          </ul>
          <div className="border-t-2 border-murekkep/12 px-5 py-4">
            <p className="text-[0.78rem] leading-relaxed text-murekkep-soft">
              <strong className="text-murekkep">Kasiyer:</strong> QR okutur, kod girer, satış tutarı girer,
              ödemeyi tamamlar, kendi işlemlerini görür. Komisyon oranını değiştiremez, kampanya kuralını
              değiştiremez, tamamlanmış işlemi silemez, havuz bakiyesini değiştiremez.
            </p>
            <p className="mt-2.5 text-[0.78rem] leading-relaxed text-murekkep-soft">
              <strong className="text-murekkep">Yönetici:</strong> Kampanya oluşturur, içerik onaylar, AI planını
              kullanır, performansı görür, personeli yönetir.
            </p>
          </div>
        </div>

        {/* Paketler */}
        <div className="border-2 border-murekkep/12 bg-white/55">
          <div className="flex items-center gap-2 border-b-2 border-murekkep/12 px-5 py-3.5">
            <Sparkles className="h-4 w-4 text-damping" />
            <h2 className="font-display text-[1.08rem] font-bold">İşletme paketleri</h2>
          </div>
          <ul>
            {pkgRows.map((p) => (
              <li key={p.id} className={`border-b border-murekkep/10 px-5 py-4 last:border-0 ${p.code === ctx.biz.planCode ? "bg-damping-soft/35" : ""}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="font-display text-[1.06rem] font-bold">{p.name}</p>
                    <p className="mt-1 text-[0.78rem] text-sicak-gri">
                      {(p.features ?? []).slice(0, 4).join(" · ")}
                    </p>
                  </div>
                  <p className="tabular text-[1.12rem] font-semibold">
                    {p.priceMonthlyCents === 0 ? "Ücretsiz" : `${fmtTL(p.priceMonthlyCents)} / ay`}
                  </p>
                </div>
                {p.code === ctx.biz.planCode ? (
                  <p className="mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-damping">
                    Aktif paketiniz
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="border-t-2 border-murekkep/12 px-5 py-4">
            <p className="text-[0.76rem] leading-relaxed text-sicak-gri">
              Paket fiyatları koda gömülü değildir; admin panelinden yönetilir. Değişiklikler anında tüm
              panellere yansır.
            </p>
          </div>
        </div>
      </div>

      {/* AI ayarları */}
      <div className="mt-8 border-2 border-murekkep">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-murekkep bg-murekkep px-5 py-3.5">
          <h2 className="font-display text-[1.06rem] font-bold uppercase tracking-[0.13em] text-kagit">
            AI servis ayarları
          </h2>
          <Stamp tone="amber">Yalnızca admin</Stamp>
        </div>
        <div className="grid gap-px bg-murekkep/12 sm:grid-cols-2 lg:grid-cols-3">
          {aiRows.map((row) => (
            <div key={row.id} className="bg-kagit p-5">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">{row.key}</p>
              <p className="tabular mt-2 text-[0.92rem] font-semibold">
                {row.key.includes("api_key") ? "•••••••• (sunucu tarafında)" : row.value}
              </p>
              <p className="mt-1.5 text-[0.74rem] leading-relaxed text-murekkep-soft">{row.description}</p>
            </div>
          ))}
        </div>
        <div className="border-t-2 border-murekkep/12 px-5 py-4">
          <p className="flex items-start gap-2 text-[0.8rem] leading-relaxed text-murekkep-soft">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-damping" />
            AI sağlayıcı anahtarları asla frontend&apos;e gönderilmez. İçerik üretimi sunucu tarafındaki API
            üzerinden yapılır; harici servise erişilemediğinde sistem yerel şablon motoruyla çalışmaya devam eder.
          </p>
          <p className="mt-2.5 flex items-start gap-2 text-[0.8rem] leading-relaxed text-murekkep-soft">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1f6f4a]" />
            AI hiçbir zaman kendiliğinden ücretli reklam başlatmaz veya müşteri indirimi tanımlamaz.
          </p>
        </div>
      </div>
    </PanelShell>
  );
}

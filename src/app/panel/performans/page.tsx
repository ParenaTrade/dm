import PanelShell from "@/components/PanelShell";
import { panelContext } from "@/lib/panel";
import { getBusinessBundle, getBusinessStats, getBusinesses, getAdPerformance } from "@/lib/queries";
import { buildSnapshot } from "@/lib/snapshot";
import { analysePerformance, weeklyReport } from "@/lib/ai";
import { BarChart, Pill, SectionTitle, StatCard, Sparkline } from "@/components/ui";
import { fmtInt, fmtPercent, fmtTL, DAY_NAMES } from "@/lib/format";
import { Sparkles, TrendingUp, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PerformansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [stats, bundle, snapshot, allBiz, ads] = await Promise.all([
    getBusinessStats(ctx.biz.id),
    getBusinessBundle(ctx.biz),
    buildSnapshot(ctx.biz),
    getBusinesses(),
    getAdPerformance(ctx.biz.id),
  ]);
  const analysis = analysePerformance(snapshot);
  const report = weeklyReport(snapshot);
  const conv = stats.campaignViews ? (stats.qrRedeemed / stats.campaignViews) * 100 : 0;

  return (
    <PanelShell ctx={ctx} active="performans" businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}>
      <SectionTitle
        eyebrow="Performans"
        title="Görüntülenme değil, gerçek sonuç."
        note="Kampanyanın kaç kişiye ulaştığından kaç kişinin kasada doğrulandığına kadar tüm zincir tek raporda."
        action={
          <Pill tone="damping">
            <TrendingUp className="h-3 w-3" /> Dönüşüm %{conv.toFixed(1)}
          </Pill>
        }
      />

      {/* Huni */}
      <div className="border-2 border-murekkep">
        <div className="border-b-2 border-murekkep bg-murekkep px-6 py-3.5">
          <h2 className="font-display text-[1.06rem] font-bold uppercase tracking-[0.13em] text-kagit">
            Dönüşüm hunisi
          </h2>
        </div>
        <div className="grid gap-px bg-murekkep/12 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Görüntülenme", stats.pageViews, 1],
            ["Kampanya görüntüleme", stats.campaignViews, 0.72],
            ["QR oluşturma", stats.qrGenerated, 0.42],
            ["QR kullanımı", stats.qrRedeemed, 0.24],
            ["Gerçek satış", stats.transactionCount, 0.18],
          ].map(([label, value, w]) => (
            <div key={label as string} className="bg-kagit p-5">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">
                {label as string}
              </p>
              <p className="tabular mt-2 text-[1.55rem] font-semibold leading-none">{fmtInt(value as number)}</p>
              <div className="mt-3 h-[3px] w-full bg-murekkep/12">
                <div className="h-full bg-damping" style={{ width: `${(w as number) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sayılar */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Doğrulanan satış tutarı" value={fmtTL(stats.revenueCents)} sub="QR ile gelen müşterilerden" accent />
        <StatCard label="Ortalama sepet" value={fmtTL(stats.avgBasketCents)} sub={`${stats.transactionCount} işlem üzerinden`} />
        <StatCard label="Kesilen indirim" value={fmtTL(stats.discountCents)} sub="Kampanya avantajı" />
        <StatCard label="Damping Hane" value={fmtTL(stats.dampingUsedCents)} sub="Kasada harcanan hak" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="border-2 border-murekkep/12 bg-white/55 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-sicak-gri">
                Günlük net satış (7 gün)
              </p>
              <p className="tabular mt-2 text-[1.75rem] font-semibold leading-none">{fmtTL(stats.netCents)}</p>
            </div>
            <Sparkline data={stats.weekSeries} />
          </div>
          <div className="mt-6">
            <BarChart
              data={stats.weekSeries}
              labels={["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]}
              height={160}
              accentIndex={stats.weekSeries.indexOf(Math.max(...stats.weekSeries))}
            />
          </div>

          <div className="mt-8 border-t border-dashed border-murekkep/25 pt-6">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-sicak-gri">
              Gün bazlı dağılım
            </p>
            <div className="mt-3">
              <BarChart
                data={stats.dayHistogram}
                labels={["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"]}
                height={130}
                accentIndex={stats.dayHistogram.indexOf(Math.max(...stats.dayHistogram))}
              />
            </div>
            <p className="mt-3 text-[0.82rem] text-murekkep-soft">
              En yüksek dönüşüm:{" "}
              <strong className="text-murekkep">
                {DAY_NAMES[stats.dayHistogram.indexOf(Math.max(...stats.dayHistogram))]}
              </strong>
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Haftalık AI raporu */}
          <div className="border-2 border-damping bg-damping-soft/35">
            <div className="flex items-center gap-2 border-b-2 border-damping bg-damping px-5 py-3">
              <Sparkles className="h-4 w-4 text-kagit" />
              <h2 className="font-display text-[1rem] font-bold uppercase tracking-[0.13em] text-kagit">
                AI büyüme raporu
              </h2>
            </div>
            <div className="p-5">
              <p className="font-display text-[1.12rem] font-bold leading-snug">{report.headline}</p>
              <ul className="mt-4 space-y-2.5">
                {report.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5 text-[0.85rem] leading-relaxed text-murekkep-soft">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-damping" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-dashed border-damping/35 pt-4">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-damping-dark">
                  Gelecek hafta için
                </p>
                <ul className="mt-2.5 space-y-2">
                  {report.suggestions.map((s) => (
                    <li key={s} className="flex gap-2 text-[0.82rem] leading-relaxed text-murekkep-soft">
                      <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-damping" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-4 text-[0.68rem] leading-relaxed text-sicak-gri">
                Bu rapor yalnızca sistemdeki gerçek kayıtlardan üretilir. Kesin satış veya müşteri garantisi
                vermez.
              </p>
            </div>
          </div>

          {/* Kampanya performansı */}
          <div className="border-2 border-murekkep/12 bg-white/55">
            <div className="border-b-2 border-murekkep/12 px-5 py-3.5">
              <h2 className="font-display text-[1.06rem] font-bold">Kampanya karşılaştırması</h2>
            </div>
            <table className="w-full text-[0.82rem]">
              <thead>
                <tr className="border-b border-murekkep/12">
                  <th className="px-5 py-2.5 text-left text-[0.62rem] uppercase tracking-[0.13em] text-sicak-gri">
                    Kampanya
                  </th>
                  <th className="px-3 py-2.5 text-right text-[0.62rem] uppercase tracking-[0.13em] text-sicak-gri">
                    Görüntüleme
                  </th>
                  <th className="px-3 py-2.5 text-right text-[0.62rem] uppercase tracking-[0.13em] text-sicak-gri">
                    Kullanım
                  </th>
                  <th className="px-5 py-2.5 text-right text-[0.62rem] uppercase tracking-[0.13em] text-sicak-gri">
                    Dönüşüm
                  </th>
                </tr>
              </thead>
              <tbody>
                {bundle.campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-murekkep/10 last:border-0">
                    <td className="px-5 py-3 font-semibold">{c.title}</td>
                    <td className="tabular px-3 py-3 text-right">{fmtInt(c.views)}</td>
                    <td className="tabular px-3 py-3 text-right">{fmtInt(c.redemptions)}</td>
                    <td className="tabular px-5 py-3 text-right text-damping">
                      {fmtPercent(c.views ? c.redemptions / c.views : 0, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI analiz notları */}
      <div className="mt-10">
        <SectionTitle
          eyebrow="AI performans analizi"
          title="Veri temelli açıklamalar."
          note="Yorumlar geçmiş kayıtlardan üretilir; gelecek için kesin sonuç vaat edilmez."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {analysis.map((a) => (
            <div key={a} className="border-l-4 border-damping bg-white/55 px-5 py-4">
              <p className="text-[0.92rem] leading-relaxed text-murekkep-soft">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reklam performansı */}
      {ads.length ? (
        <div className="mt-10">
          <SectionTitle eyebrow="Reklam" title="Bölgesel görünürlük performansı." />
          <div className="grid gap-4 md:grid-cols-2">
            {ads.map((ad) => (
              <div key={ad.id} className="border-2 border-murekkep/12 bg-white/55 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-damping">
                      {ad.placement}
                    </p>
                    <h3 className="mt-1.5 font-display text-[1.08rem] font-bold">{ad.name}</h3>
                  </div>
                  <Pill tone={ad.status === "ACTIVE" ? "green" : "neutral"}>{ad.status}</Pill>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-px border border-murekkep/15 bg-murekkep/15">
                  {[
                    ["Gösterim", fmtInt(ad.impressions)],
                    ["Tıklama", fmtInt(ad.clicks)],
                    ["CTR", fmtPercent(ad.impressions ? ad.clicks / ad.impressions : 0, 2)],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-kagit px-3 py-2.5">
                      <p className="tabular text-[1.02rem] font-semibold">{v}</p>
                      <p className="mt-1 text-[0.58rem] uppercase tracking-[0.12em] text-sicak-gri">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </PanelShell>
  );
}

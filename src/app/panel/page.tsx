import Link from "next/link";
import { ArrowUpRight, Sparkles, QrCode, TrendingUp, AlertCircle } from "lucide-react";
import PanelShell from "@/components/PanelShell";
import { panelContext, panelUrl } from "@/lib/panel";
import { getBusinessStats, getLatestTransactions, getBusinessBundle, getBusinesses } from "@/lib/queries";
import { buildSnapshot } from "@/lib/snapshot";
import { analysePerformance, suggestCampaign } from "@/lib/ai";
import { BarChart, Pill, SectionTitle, StatCard, Btn } from "@/components/ui";
import { fmtDateTime, fmtTL, DAY_NAMES } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PanelHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [stats, recent, bundle, snapshot, allBiz] = await Promise.all([
    getBusinessStats(ctx.biz.id),
    getLatestTransactions(ctx.biz.id, 8),
    getBusinessBundle(ctx.biz),
    buildSnapshot(ctx.biz),
    getBusinesses(),
  ]);

  const suggestion = suggestCampaign(snapshot, "Bu hafta müşteri sayısını artırmak istiyorum.");
  const insights = analysePerformance(snapshot).slice(0, 3);
  const q = `biz=${encodeURIComponent(ctx.slug)}&rol=${ctx.role}`;

  return (
    <PanelShell
      ctx={ctx}
      active="genel"
      businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}
    >
      <SectionTitle
        eyebrow="Genel Bakış"
        title={`Bugün ${ctx.biz.district}'te neler oluyor?`}
        note="Tüm rakamlar doğrulanmış satış kayıtlarından hesaplanır. Görüntülenme sayısı tek başına başarı ölçütü değildir."
        action={
          <div className="flex gap-2">
            <Btn href={`/panel/kasa?${q}`} variant="ink">
              <QrCode className="h-4 w-4" /> Kasa&apos;yı aç
            </Btn>
            <Btn href={`/panel/ai?${q}`}>
              <Sparkles className="h-4 w-4" /> AI&apos;ya sor
            </Btn>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Bugün müşteri" value={String(stats.todayCustomers)} sub="QR ile doğrulanan girişler" accent />
        <StatCard label="Bugün satış" value={fmtTL(stats.todaySalesCents)} sub="Net tahsil edilen tutar" />
        <StatCard label="Kampanya kullanımı" value={String(stats.qrRedeemed)} sub="Toplam doğrulanan QR" />
        <StatCard label="QR üretimi" value={String(stats.qrGenerated)} sub="Müşteri tarafından oluşturulan" />
        <StatCard
          label="Damping Hane kullanımı"
          value={fmtTL(stats.dampingUsedCents)}
          sub="Kasada harcanan sadakat hakkı"
        />
        <StatCard label="Yeni müşteriler" value={String(stats.newCustomers)} sub="Farklı müşteri sayısı" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        {/* Grafik */}
        <div className="border-2 border-murekkep/12 bg-white/55 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-sicak-gri">
                Son 7 gün net satış
              </p>
              <p className="tabular mt-2 text-[1.85rem] font-semibold leading-none">{fmtTL(stats.netCents)}</p>
            </div>
            <Pill tone="ink">
              <TrendingUp className="h-3 w-3" /> {stats.transactionCount} işlem
            </Pill>
          </div>
          <div className="mt-6">
            <BarChart
              data={stats.weekSeries}
              labels={["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]}
              height={170}
              accentIndex={stats.weekSeries.indexOf(Math.max(...stats.weekSeries))}
            />
          </div>

          <div className="mt-7 border-t border-dashed border-murekkep/25 pt-5">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-sicak-gri">
              Saatlik yoğunluk
            </p>
            <div className="mt-3">
              <BarChart
                data={stats.hourHistogram.filter((_, i) => i >= 8 && i <= 23)}
                labels={stats.hourHistogram.map((_, i) => (i >= 8 && i <= 23 ? String(i) : "")).filter(Boolean)}
                height={110}
                accentIndex={(() => {
                  const sliced = stats.hourHistogram.slice(8, 24);
                  return sliced.indexOf(Math.min(...sliced)) ;
                })()}
              />
            </div>
            <p className="mt-3 flex items-start gap-2 text-[0.78rem] leading-relaxed text-murekkep-soft">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-damping" />
              Düşük yoğunluk saatleri vurgulandı — AI bu aralıklar için kampanya öneriyor.
            </p>
          </div>
        </div>

        {/* AI önerisi */}
        <div className="space-y-6">
          <div className="border-2 border-damping bg-damping-soft/40">
            <div className="flex items-center justify-between gap-3 border-b-2 border-damping bg-damping px-5 py-3">
              <p className="flex items-center gap-2 font-display text-[0.98rem] font-bold uppercase tracking-[0.13em] text-kagit">
                <Sparkles className="h-4 w-4" /> AI Pazarlama Asistanı
              </p>
              <span className="text-[0.66rem] uppercase tracking-[0.14em] text-kagit/85">Bugünün önerisi</span>
            </div>
            <div className="p-5">
              <p className="text-[0.92rem] leading-relaxed text-murekkep-soft">
                “Son 7 günlük verilere göre düşük etkileşimli saatler için bir kampanya öneriyorum.”
              </p>
              <p className="mt-4 font-display text-[1.18rem] font-bold leading-snug">{suggestion.title}</p>
              <p className="mt-2 text-[0.86rem] leading-relaxed text-murekkep-soft">{suggestion.description}</p>
              <dl className="mt-4 space-y-1.5 text-[0.8rem]">
                <div className="flex justify-between border-b border-dashed border-damping/30 pb-1.5">
                  <dt className="text-sicak-gri">Önerilen indirim</dt>
                  <dd className="tabular font-semibold">%{suggestion.discountPercent}</dd>
                </div>
                <div className="flex justify-between border-b border-dashed border-damping/30 pb-1.5">
                  <dt className="text-sicak-gri">Saat aralığı</dt>
                  <dd className="tabular font-semibold">
                    {suggestion.timeStart}–{suggestion.timeEnd}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sicak-gri">Hedef kitle</dt>
                  <dd className="max-w-[55%] text-right font-semibold">{suggestion.audience}</dd>
                </div>
              </dl>
              <p className="mt-4 text-[0.72rem] leading-relaxed text-sicak-gri">{suggestion.rationale}</p>
              <div className="mt-4">
                <Btn href={`/panel/ai?${q}`} className="w-full">
                  Kampanya oluştur <ArrowUpRight className="h-4 w-4" />
                </Btn>
              </div>
              <p className="mt-3 text-[0.68rem] leading-relaxed text-sicak-gri">
                AI yalnızca öneri üretir. Onaylamadığınız hiçbir kampanya, indirim veya ücretli reklam yayına
                alınmaz.
              </p>
            </div>
          </div>

          <div className="border-2 border-murekkep/12 bg-white/55 p-5">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-sicak-gri">
              AI performans notları
            </p>
            <ul className="mt-3.5 space-y-3">
              {insights.map((i) => (
                <li key={i} className="flex gap-2.5 text-[0.83rem] leading-relaxed text-murekkep-soft">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-damping" />
                  {i}
                </li>
              ))}
            </ul>
            <Link
              href={`/panel/performans?${q}`}
              className="mt-4 inline-flex items-center gap-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-damping hover:underline"
            >
              Tüm analiz <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Son işlemler */}
      <div className="mt-10">
        <SectionTitle
          eyebrow="Damping Kasa"
          title="Son işlemler"
          note="Her işlem sunucuda doğrulanarak kaydedilir. Tamamlanmış işlemler silinemez, yalnızca iade kaydı oluşturulur."
          action={
            <Btn href={`/panel/hakedis?${q}`} variant="outline">
              Hakediş raporu
            </Btn>
          }
        />
        <div className="overflow-x-auto thin-scroll border-2 border-murekkep/12">
          <table className="w-full min-w-[760px] text-[0.82rem]">
            <thead>
              <tr className="bg-murekkep text-kagit">
                {["Fiş no", "Tarih", "Kampanya", "Satış", "İndirim", "Damping Hane", "Ödenecek", "Komisyon", "Durum"].map(
                  (h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[0.62rem] font-semibold uppercase tracking-[0.13em]">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => {
                const camp = bundle.campaigns.find((c) => c.id === t.campaignId);
                return (
                  <tr key={t.id} className="border-b border-murekkep/10 last:border-0 odd:bg-kagit/40">
                    <td className="tabular px-3.5 py-2.5 font-semibold">{t.receiptNo}</td>
                    <td className="px-3.5 py-2.5 text-sicak-gri">{fmtDateTime(t.createdAt)}</td>
                    <td className="px-3.5 py-2.5">{camp?.title ?? "—"}</td>
                    <td className="tabular px-3.5 py-2.5">{fmtTL(t.grossAmountCents)}</td>
                    <td className="tabular px-3.5 py-2.5 text-damping">-{fmtTL(t.discountCents)}</td>
                    <td className="tabular px-3.5 py-2.5">-{fmtTL(t.dampingUsedCents)}</td>
                    <td className="tabular px-3.5 py-2.5 font-semibold">{fmtTL(t.netAmountCents)}</td>
                    <td className="tabular px-3.5 py-2.5 text-sicak-gri">{fmtTL(t.commissionCents)}</td>
                    <td className="px-3.5 py-2.5">
                      <Pill tone={t.status === "COMPLETED" ? "green" : t.status === "REVERSED" ? "neutral" : "amber"}>
                        {t.status === "COMPLETED" ? "Tamamlandı" : t.status === "REVERSED" ? "İade" : t.status}
                      </Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kampanya performansı */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {bundle.campaigns.slice(0, 2).map((c) => (
          <div key={c.id} className="border-2 border-murekkep/12 bg-white/55 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-damping">{c.code}</p>
                <h3 className="mt-2 font-display text-[1.18rem] font-bold leading-snug">{c.title}</h3>
              </div>
              <p className="tabular text-[1.65rem] font-semibold leading-none text-damping">
                {c.discountPercent > 0 ? `%${c.discountPercent}` : fmtTL(c.discountAmountCents)}
              </p>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-px border border-murekkep/15 bg-murekkep/15">
              {[
                ["Görüntülenme", String(c.views)],
                ["Tıklama", String(c.clicks)],
                ["Kullanım", String(c.redemptions)],
              ].map(([l, v]) => (
                <div key={l} className="bg-kagit px-3 py-3">
                  <p className="tabular text-[1.15rem] font-semibold leading-none">{v}</p>
                  <p className="mt-1.5 text-[0.6rem] uppercase tracking-[0.12em] text-sicak-gri">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[0.82rem] leading-relaxed text-murekkep-soft">
              Dönüşüm:{" "}
              <strong className="tabular text-murekkep">
                %{c.views ? ((c.redemptions / c.views) * 100).toFixed(1) : "0.0"}
              </strong>{" "}
              · En yoğun gün: {DAY_NAMES[stats.dayHistogram.indexOf(Math.max(...stats.dayHistogram))]}
            </p>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

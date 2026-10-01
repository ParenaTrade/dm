import PanelShell from "@/components/PanelShell";
import { panelContext } from "@/lib/panel";
import { getBusinesses, getBusinessStats, getPoolLedgerByBusiness, getLatestTransactions } from "@/lib/queries";
import { Pill, SectionTitle, StatCard, Stamp } from "@/components/ui";
import { fmtDate, fmtDateTime, fmtPercent, fmtTL } from "@/lib/format";
import { Lock, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HakedisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [stats, poolRows, allBiz, txs] = await Promise.all([
    getBusinessStats(ctx.biz.id),
    getPoolLedgerByBusiness(),
    getBusinesses(),
    getLatestTransactions(ctx.biz.id, 10),
  ]);
  const contract = allBiz ? ctx.biz : ctx.biz;
  const myRow = poolRows.find((r) => r.businessId === ctx.biz.id);

  return (
    <PanelShell ctx={ctx} active="hakedis" businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}>
      <SectionTitle
        eyebrow="Hakediş / Komisyon"
        title="Şeffaf komisyon, izlenebilir hakediş."
        note="Komisyon oranı işletme sözleşmesine bağlıdır ve kasiyer tarafından değiştirilemez. Hesaplama tabanı sözleşmede tanımlıdır."
        action={
          <Pill tone="ink">
            <Lock className="h-3 w-3" /> Sözleşme kilitli
          </Pill>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Brüt satış" value={fmtTL(stats.grossCents)} sub="Toplam satış tutarı" />
        <StatCard label="Kesilen indirim" value={fmtTL(stats.discountCents)} sub="Kampanya avantajı" />
        <StatCard label="Damping Hane kullanımı" value={fmtTL(stats.dampingUsedCents)} sub="Müşteri hakkı" />
        <StatCard label="DampingVar komisyonu" value={fmtTL(stats.commissionCents)} sub="İşletme tarafından ödenir" accent />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        {/* Hakediş tablosu */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-[1.32rem] font-bold">Dönem hakediş dökümü</h2>
            <Pill tone="neutral">
              <FileText className="h-3 w-3" /> Son 30 gün
            </Pill>
          </div>
          <div className="border-2 border-murekkep/12 bg-white/55">
            <table className="w-full text-[0.86rem]">
              <tbody>
                {[
                  ["Brüt satış toplamı", fmtTL(stats.grossCents), ""],
                  ["Kampanya indirimi", `-${fmtTL(stats.discountCents)}`, "text-damping"],
                  ["Damping Hane kullanımı", `-${fmtTL(stats.dampingUsedCents)}`, "text-damping"],
                  ["Net satış (tahsil edilen)", fmtTL(stats.netCents), "font-semibold"],
                  ["Komisyon tabanı", fmtTL(stats.netCents), ""],
                  ["DampingVar komisyonu", `-${fmtTL(stats.commissionCents)}`, "text-damping font-semibold"],
                  ["Ortak havuz katkısı", `-${fmtTL(stats.poolContributionCents)}`, "text-damping"],
                  ["İşletme hakedişi", fmtTL(stats.netCents - stats.commissionCents), "font-semibold text-[#1f6f4a]"],
                ].map(([label, value, cls]) => (
                  <tr key={label as string} className="border-b border-murekkep/10 last:border-0">
                    <td className="px-5 py-3 text-murekkep-soft">{label as string}</td>
                    <td className={`tabular px-5 py-3 text-right ${cls as string}`}>{value as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t-2 border-dashed border-murekkep/25 px-5 py-4">
              <p className="text-[0.76rem] leading-relaxed text-sicak-gri">
                Komisyon tabanı:{" "}
                <strong className="text-murekkep">
                  indirim ve Damping Hane sonrası tutar (AFTER_DAMPING)
                </strong>
                . Bu taban işletme sözleşmesine göre brüt satış veya indirim sonrası satış olarak da
               landırılabilir.
              </p>
            </div>
          </div>

          {/* Son işlemler */}
          <div className="mt-8">
            <h2 className="mb-4 font-display text-[1.18rem] font-bold">İşlem bazlı komisyon</h2>
            <div className="overflow-x-auto thin-scroll border-2 border-murekkep/12">
              <table className="w-full min-w-[640px] text-[0.82rem]">
                <thead>
                  <tr className="bg-murekkep text-kagit">
                    {["Fiş", "Tarih", "Taban", "Oran", "Komisyon", "Havuz"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[0.62rem] font-semibold uppercase tracking-[0.13em]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.id} className="border-b border-murekkep/10 last:border-0 odd:bg-kagit/40">
                      <td className="tabular px-4 py-2.5 font-semibold">{t.receiptNo}</td>
                      <td className="px-4 py-2.5 text-sicak-gri">{fmtDateTime(t.createdAt)}</td>
                      <td className="tabular px-4 py-2.5">{fmtTL(t.commissionBaseCents)}</td>
                      <td className="tabular px-4 py-2.5">{fmtPercent(t.commissionRate, 1)}</td>
                      <td className="tabular px-4 py-2.5 font-semibold text-damping">{fmtTL(t.commissionCents)}</td>
                      <td className="tabular px-4 py-2.5 text-murekkep-soft">{fmtTL(t.poolContributionCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sözleşme + mahsup */}
        <div className="space-y-6">
          <div className="border-2 border-murekkep">
            <div className="border-b-2 border-murekkep bg-murekkep px-5 py-3">
              <h2 className="font-display text-[1.02rem] font-bold uppercase tracking-[0.13em] text-kagit">
                İşletme sözleşmesi
              </h2>
            </div>
            <div className="p-5">
              <div className="mb-4">
                <Stamp>Kilitli</Stamp>
              </div>
              <dl className="space-y-2.5 text-[0.86rem]">
                {[
                  ["Komisyon oranı", fmtPercent(0.06, 1)],
                  ["Komisyon tabanı", "İndirim + Damping Hane sonrası"],
                  ["Sabit ücret", "0,00 TL"],
                  ["Müşteri başına ücret", "0,00 TL"],
                  ["Referral payı", fmtPercent(0.01, 1)],
                  ["Havuz katkısı", fmtPercent(0.03, 1)],
                  ["Müşteri damping kazancı", fmtPercent(0.02, 1)],
                  ["Paket", ctx.biz.planCode],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-dashed border-murekkep/20 pb-2">
                    <dt className="text-murekkep-soft">{k}</dt>
                    <dd className="tabular font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[0.74rem] leading-relaxed text-sicak-gri">
                Kasiyer bu değerleri görebilir ancak değiştiremez. Değişiklik yalnızca işletme sahibi ve admin
                tarafından yapılabilir.
              </p>
            </div>
          </div>

          <div className="border-2 border-dashed border-damping/45 p-5">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-damping-dark">
              Damping Hane mahsup raporu
            </p>
            <ul className="mt-3.5 space-y-3">
              {poolRows.map((r) => (
                <li key={r.businessId} className="border-b border-dashed border-murekkep/20 pb-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.85rem] font-semibold">{r.name}</span>
                    <span
                      className={`tabular text-[0.95rem] font-semibold ${
                        r.netCents >= 0 ? "text-[#1f6f4a]" : "text-damping"
                      }`}
                    >
                      {r.netCents >= 0 ? "+" : "-"}
                      {fmtTL(Math.abs(r.netCents))}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.72rem] text-sicak-gri">
                    Havuza katkı {fmtTL(r.contributedCents)} · Kullanım {fmtTL(r.consumedCents)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.76rem] leading-relaxed text-sicak-gri">
              V1&apos;de otomatik para transferi yapılmaz; öncelikle doğru ledger ve hesaplama sistemi kurulur.
              İşletmenizin net pozisyonu:{" "}
              <strong className="tabular text-murekkep">{fmtTL(myRow?.netCents ?? 0)}</strong>
            </p>
            <p className="mt-2 text-[0.72rem] text-sicak-gri">Dönem: {fmtDate(new Date())} itibarıyla</p>
          </div>

          <div className="border-2 border-murekkep/12 bg-white/55 p-5">
            <h3 className="font-display text-[1.02rem] font-bold">Gelir modeli</h3>
            <ul className="mt-3 space-y-2 text-[0.82rem] leading-relaxed text-murekkep-soft">
              <li>• İşletme aboneliği (paket)</li>
              <li>• DampingVar komisyonu</li>
              <li>• Gerçek müşteri / işlem bazlı ücret</li>
              <li>• Reklam ve öne çıkarma</li>
              <li>• AI pazarlama paketi</li>
            </ul>
            <p className="mt-3 text-[0.72rem] text-sicak-gri">
              Tüm oranlar kod içine sabitlenmez; admin panelinden yönetilebilir.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-8 text-[0.74rem] text-sicak-gri">
        Sözleşme kimliği: {contract?.id ?? "—"}
      </p>
    </PanelShell>
  );
}

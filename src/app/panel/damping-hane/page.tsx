import PanelShell from "@/components/PanelShell";
import { panelContext } from "@/lib/panel";
import { getBusinesses, getPool, getPoolLedgerByBusiness, getWallets, getWalletLedger } from "@/lib/queries";
import { Pill, SectionTitle, StatCard } from "@/components/ui";
import { fmtDate, fmtTL } from "@/lib/format";
import { Wallet, ShieldAlert, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_TR: Record<string, string> = {
  PENDING: "Beklemede",
  AVAILABLE: "Kullanılabilir",
  RESERVED: "Rezerve",
  SPENT: "Harcanan",
  EXPIRED: "Süresi doldu",
  CANCELLED: "İptal",
  FRAUD_REVIEW: "İncelemede",
};

export default async function DampingHanePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [wallets, pool, poolRows, allBiz] = await Promise.all([
    getWallets(),
    getPool(),
    getPoolLedgerByBusiness(),
    getBusinesses(),
  ]);
  const ledger = wallets[0] ? await getWalletLedger(wallets[0].id, 12) : [];
  const myRow = poolRows.find((r) => r.businessId === ctx.biz.id);

  return (
    <PanelShell ctx={ctx} active="hane" businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}>
      <SectionTitle
        eyebrow="Damping Hane & Ortak Havuz"
        title="Karşılığı olan ödül, gerçek hareket."
        note="Gerçekleşmiş ve uygun bir işlem olmadan Damping Hane üretilmez. Bakiye ledger ile tutulur; negatif bakiye yasaktır."
        action={
          <Pill tone="damping">
            <Wallet className="h-3 w-3" /> Network-wide hak
          </Pill>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ortak havuz bakiyesi"
          value={fmtTL(pool?.balanceCents ?? 0)}
          sub="Gerçekleşmiş işlemlerden finanse edilir"
          accent
        />
        <StatCard
          label="İşletmenin havuz katkısı"
          value={fmtTL(myRow?.contributedCents ?? 0)}
          sub="Bu işletmenin oluşturduğu karşılık"
        />
        <StatCard
          label="İşletmede harcanan"
          value={fmtTL(myRow?.consumedCents ?? 0)}
          sub="Müşterilerin bu noktada kullandığı hak"
        />
        <StatCard
          label="Net mahsup pozisyonu"
          value={fmtTL(myRow?.netCents ?? 0)}
          sub={Number(myRow?.netCents ?? 0) >= 0 ? "Havuza net katkı" : "Havuzdan net kullanım"}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        {/* Cüzdanlar */}
        <div>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b-2 border-murekkep pb-4">
            <div>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-damping">
                Müşteri cüzdanları
              </p>
              <h2 className="mt-2 font-display text-[1.55rem] font-extrabold leading-none tracking-[-0.025em]">
                Damping Hane bakiyeleri
              </h2>
            </div>
            <Pill tone="neutral">Nakit değildir · Çekilemez · Devredilemez</Pill>
          </div>

          <div className="overflow-x-auto thin-scroll border-2 border-murekkep/12">
            <table className="w-full min-w-[620px] text-[0.82rem]">
              <thead>
                <tr className="bg-murekkep text-kagit">
                  {["Müşteri", "Referral", "Kullanılabilir", "Bekleyen", "Toplam kazanç", "Toplam harcama"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[0.62rem] font-semibold uppercase tracking-[0.13em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.id} className="border-b border-murekkep/10 last:border-0 odd:bg-kagit/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{w.name}</p>
                      <p className="text-[0.72rem] text-sicak-gri">{w.email}</p>
                    </td>
                    <td className="tabular px-4 py-3 text-damping">{w.referralCode}</td>
                    <td className="tabular px-4 py-3 font-semibold">{fmtTL(w.availableCents)}</td>
                    <td className="tabular px-4 py-3 text-sicak-gri">{fmtTL(w.pendingCents)}</td>
                    <td className="tabular px-4 py-3">{fmtTL(w.lifetimeEarnedCents)}</td>
                    <td className="tabular px-4 py-3">{fmtTL(w.lifetimeSpentCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ledger */}
          <div className="mt-8">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="font-display text-[1.18rem] font-bold">Cüzdan defteri (ledger)</h3>
              <Pill tone="neutral">Her hareket tek kayıt</Pill>
            </div>
            <ul className="border-2 border-murekkep/12">
              {ledger.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-murekkep/10 px-5 py-3 last:border-0"
                >
                  <div>
                    <p className="text-[0.86rem] font-semibold">{l.description}</p>
                    <p className="text-[0.72rem] text-sicak-gri">
                      {fmtDate(l.createdAt)} · {l.entryType} · {l.refType ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Pill tone={l.status === "AVAILABLE" ? "green" : l.status === "SPENT" ? "neutral" : "amber"}>
                      {STATUS_TR[l.status] ?? l.status}
                    </Pill>
                    <span
                      className={`tabular text-[1.02rem] font-semibold ${
                        l.amountCents >= 0 ? "text-[#1f6f4a]" : "text-damping"
                      }`}
                    >
                      {l.amountCents >= 0 ? "+" : "-"}
                      {fmtTL(Math.abs(l.amountCents))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Havuz + kurallar */}
        <div className="space-y-6">
          <div className="border-2 border-murekkep">
            <div className="border-b-2 border-murekkep bg-murekkep px-5 py-3">
              <h2 className="font-display text-[1.02rem] font-bold uppercase tracking-[0.13em] text-kagit">
                Mahup özeti
              </h2>
            </div>
            <ul className="divide-y divide-murekkep/10">
              {poolRows.map((r) => (
                <li key={r.businessId} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[0.86rem] font-semibold">{r.name}</p>
                    <p
                      className={`tabular text-[0.98rem] font-semibold ${
                        r.netCents >= 0 ? "text-[#1f6f4a]" : "text-damping"
                      }`}
                    >
                      {r.netCents >= 0 ? "+" : "-"}
                      {fmtTL(Math.abs(r.netCents))}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[0.72rem] text-sicak-gri">
                    <span>Katkı: {fmtTL(r.contributedCents)}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>Kullanım: {fmtTL(r.consumedCents)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-2 border-dashed border-damping/45 p-5">
            <p className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-damping-dark">
              <ShieldAlert className="h-3.5 w-3.5" /> Kurallar
            </p>
            <ul className="mt-3.5 space-y-2.5 text-[0.84rem] leading-relaxed text-murekkep-soft">
              <li>• Damping Hane nakit değildir, çekilemez, banka hesabına aktarılamaz.</li>
              <li>• V1&apos;de başka müşteriye transfer edilemez.</li>
              <li>• Yalnızca uygun Damping Noktalarında indirim avantajı olarak kullanılabilir.</li>
              <li>• Kullanılabilir olmayan ödül harcanamaz, bakiye negatife düşürülemez.</li>
              <li>• Aynı QR aynı anda iki kez kullanılamaz (satır kilidi ile korunur).</li>
              <li>• Ödül, yalnızca tamamlanmış ve iade edilmemiş işlemden sonra üretilir.</li>
            </ul>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

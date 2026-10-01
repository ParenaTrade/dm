import PanelShell from "@/components/PanelShell";
import { panelContext } from "@/lib/panel";
import { getBusinessCustomers, getBusinesses } from "@/lib/queries";
import { Pill, SectionTitle, StatCard } from "@/components/ui";
import { fmtDate, fmtTL } from "@/lib/format";
import { UserPlus, Share2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MusterilerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [customers, allBiz] = await Promise.all([getBusinessCustomers(ctx.biz.id), getBusinesses()]);
  const total = customers.reduce((s, c) => s + (c.spendCents ?? 0), 0);

  return (
    <PanelShell ctx={ctx} active="musteriler" businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}>
      <SectionTitle
        eyebrow="Müşteriler"
        title="Gerçek gelen müşteriler."
        note="Bu listedeki her kayıt, kasada doğrulanmış bir QR işleminden gelir. Tahmini trafik değil, gerçek ziyaret."
        action={<Pill tone="ink">{customers.length} kayıtlı müşteri</Pill>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam müşteri" value={String(customers.length)} sub="QR ile doğrulanan" accent />
        <StatCard label="Toplam satış" value={fmtTL(total)} sub="Bu müşterilerden gelen" />
        <StatCard
          label="Ortalama müşteri değeri"
          value={fmtTL(customers.length ? Math.round(total / customers.length) : 0)}
          sub="Müşteri başına net satış"
        />
        <StatCard label="Paylaş & Kazan" value="Aktif" sub="Tek seviye referral ağı" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-x-auto thin-scroll border-2 border-murekkep/12">
          <table className="w-full min-w-[640px] text-[0.84rem]">
            <thead>
              <tr className="bg-murekkep text-kagit">
                {["Müşteri", "İlçe", "Ziyaret", "Toplam harcama", "Son ziyaret", "Referral kodu"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[0.62rem] font-semibold uppercase tracking-[0.13em]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-murekkep/10 last:border-0 odd:bg-kagit/40">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-[0.74rem] text-sicak-gri">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-murekkep-soft">{c.district ?? "—"}</td>
                  <td className="tabular px-4 py-3">{c.visitCount}</td>
                  <td className="tabular px-4 py-3 font-semibold">{fmtTL(c.spendCents ?? 0)}</td>
                  <td className="px-4 py-3 text-sicak-gri">
                    {c.lastVisit ? fmtDate(c.lastVisit) : "—"}
                  </td>
                  <td className="tabular px-4 py-3 text-damping">{c.referralCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="border-2 border-dashed border-damping/45 p-5">
            <p className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-damping-dark">
              <Share2 className="h-3.5 w-3.5" /> Paylaş & Kazan
            </p>
            <h3 className="mt-3 font-display text-[1.18rem] font-bold leading-snug">
              Müşterileriniz sizi tavsiye ederek Damping Hane kazanıyor.
            </h3>
            <p className="mt-2.5 text-[0.85rem] leading-relaxed text-murekkep-soft">
              Tek seviye sistem: davet eden müşteri ödül alır. İkinci seviyeden ödül üretilmez; MLM yapısı
              kurulmaz. Ödül yalnızca tamamlanmış ve iade edilmemiş satıştan sonra geçerli olur.
            </p>
            <div className="mt-4 border-2 border-murekkep/15 bg-kagit px-4 py-3">
              <p className="text-[0.62rem] uppercase tracking-[0.16em] text-sicak-gri">Örnek referral linki</p>
              <p className="tabular mt-1.5 text-[0.86rem] text-murekkep">
                dampingvar.com/davet/{customers[0]?.referralCode ?? "AHMET728"}
              </p>
            </div>
          </div>

          <div className="border-2 border-murekkep/12 bg-white/55 p-5">
            <p className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-sicak-gri">
              <UserPlus className="h-3.5 w-3.5" /> Müşteri kazanımı
            </p>
            <ul className="mt-4 space-y-3 text-[0.85rem] leading-relaxed text-murekkep-soft">
              <li className="border-b border-dashed border-murekkep/20 pb-3">
                <strong className="text-murekkep">Yeni müşteri</strong> — ilk kez QR ile gelenler işletme
                sayfasından bağımsız olarak raporlanır.
              </li>
              <li className="border-b border-dashed border-murekkep/20 pb-3">
                <strong className="text-murekkep">Tekrar müşteri</strong> — aynı müşterinin ikinci ve sonraki
                işlemleri sadakat göstergesidir.
              </li>
              <li>
                <strong className="text-murekkep">Damping Hane</strong> — müşterinin kazandığı hak, başka Damping
                Noktalarında da kullanılabilir.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

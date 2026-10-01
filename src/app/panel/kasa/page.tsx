import PanelShell from "@/components/PanelShell";
import { panelContext } from "@/lib/panel";
import { getBusinessBundle, getBusinesses, getLatestTransactions } from "@/lib/queries";
import { Pill, SectionTitle } from "@/components/ui";
import KasaClient from "@/components/KasaClient";
import { db } from "@/db";
import { qrCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fmtDateTime, fmtTL } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function KasaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [bundle, allBiz, qrs, recent] = await Promise.all([
    getBusinessBundle(ctx.biz),
    getBusinesses(),
    db.select().from(qrCodes).where(eq(qrCodes.businessId, ctx.biz.id)),
    getLatestTransactions(ctx.biz.id, 6),
  ]);

  return (
    <PanelShell ctx={ctx} active="kasa" businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}>
      <SectionTitle
        eyebrow="Damping Kasa"
        title="QR okut, tutarı gir, işlemi tamamla."
        note="Kasiyer ekranı dört adımda biter: QR → Tutar → İndirim → Ödeme. Komisyon oranları, kampanya kuralları ve bakiyeler değiştirilemez."
        action={
          <div className="flex gap-2">
            <Pill tone="ink">Kasiyer: {ctx.actorName}</Pill>
            <Pill tone="damping">{qrs.filter((q) => q.status === "ACTIVE").length} aktif QR</Pill>
          </div>
        }
      />

      <KasaClient
        businessId={ctx.biz.id}
        businessName={ctx.biz.name}
        district={ctx.biz.district}
        actorEmail={ctx.actorEmail}
        role={ctx.role}
        qrCodes={qrs.map((q) => ({ code: q.code, status: q.status, customerId: q.customerId }))}
        campaigns={bundle.campaigns.map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          discountPercent: c.discountPercent,
        }))}
        contractBase={bundle.contract?.commissionBase ?? "AFTER_DAMPING"}
      />

      {/* Kasiyerin kendi işlemleri */}
      <div className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b-2 border-murekkep pb-4">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-damping">
              Kasiyer işlem geçmişi
            </p>
            <h2 className="mt-2 font-display text-[1.75rem] font-extrabold leading-none tracking-[-0.025em]">
              Bugün tamamlanan satışlar
            </h2>
          </div>
          <Link
            href={`/panel/hakedis?biz=${encodeURIComponent(ctx.slug)}&rol=${ctx.role}`}
            className="text-[0.74rem] font-semibold uppercase tracking-[0.13em] text-murekkep-soft hover:text-damping"
          >
            Tüm hakediş raporu →
          </Link>
        </div>

        <div className="overflow-x-auto thin-scroll border-2 border-murekkep/12">
          <table className="w-full min-w-[700px] text-[0.82rem]">
            <thead>
              <tr className="bg-murekkep text-kagit">
                {["Fiş no", "Saat", "Satış", "İndirim", "Damping Hane", "Ödenecek", "Komisyon"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[0.62rem] font-semibold uppercase tracking-[0.13em]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} className="border-b border-murekkep/10 last:border-0 odd:bg-kagit/40">
                  <td className="tabular px-4 py-2.5 font-semibold">{t.receiptNo}</td>
                  <td className="px-4 py-2.5 text-sicak-gri">{fmtDateTime(t.createdAt)}</td>
                  <td className="tabular px-4 py-2.5">{fmtTL(t.grossAmountCents)}</td>
                  <td className="tabular px-4 py-2.5 text-damping">-{fmtTL(t.discountCents)}</td>
                  <td className="tabular px-4 py-2.5">-{fmtTL(t.dampingUsedCents)}</td>
                  <td className="tabular px-4 py-2.5 font-semibold">{fmtTL(t.netAmountCents)}</td>
                  <td className="tabular px-4 py-2.5 text-sicak-gri">{fmtTL(t.commissionCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PanelShell>
  );
}

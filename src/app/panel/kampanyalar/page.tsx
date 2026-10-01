import PanelShell from "@/components/PanelShell";
import { panelContext } from "@/lib/panel";
import { getBusinessBundle, getBusinesses } from "@/lib/queries";
import { Pill, SectionTitle, Stamp } from "@/components/ui";
import CampaignForm from "@/components/CampaignForm";
import { DAY_NAMES, fmtDate, fmtTL } from "@/lib/format";
import { QrCode, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KampanyalarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [bundle, allBiz] = await Promise.all([getBusinessBundle(ctx.biz), getBusinesses()]);
  const allowed = ctx.role !== "CASHIER";

  return (
    <PanelShell ctx={ctx} active="kampanyalar" businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}>
      <SectionTitle
        eyebrow="Kampanyalar"
        title="Damping kurallarını sen belirle."
        note="İndirim, yüzde, sabit tutar, saat, gün, ilk alışveriş ve QR özel kampanyaları. Tüm kurallar kasada otomatik uygulanır."
      />

      <div className="grid gap-8 xl:grid-cols-[1.25fr_1fr]">
        <div>
          <CampaignForm businessId={ctx.biz.id} actorEmail={ctx.actorEmail} allowed={allowed} slug={ctx.slug} />
        </div>

        <div className="space-y-6">
          <div className="border-2 border-murekkep/12 bg-white/55">
            <div className="flex items-center justify-between gap-3 border-b-2 border-murekkep/12 px-5 py-3.5">
              <h2 className="font-display text-[1.06rem] font-bold">Aktif kampanyalar</h2>
              <Pill tone="ink">{bundle.campaigns.length} kayıt</Pill>
            </div>
            <ul>
              {bundle.campaigns.map((c) => (
                <li key={c.id} className="border-b border-murekkep/10 px-5 py-4 last:border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="tabular text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-damping">
                        {c.code}
                      </p>
                      <p className="mt-1 font-semibold leading-snug">{c.title}</p>
                      <p className="mt-1.5 text-[0.78rem] leading-relaxed text-murekkep-soft">
                        {c.description?.slice(0, 110)}
                        {(c.description?.length ?? 0) > 110 ? "…" : ""}
                      </p>
                    </div>
                    <p className="tabular shrink-0 text-[1.32rem] font-semibold text-damping">
                      {c.discountPercent > 0 ? `%${c.discountPercent}` : fmtTL(c.discountAmountCents)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] text-sicak-gri">
                    <span className="tabular">
                      {c.timeStart ? `${c.timeStart}–${c.timeEnd}` : "Tüm saatler"}
                    </span>
                    <span>
                      {c.days && (c.days as number[]).length
                        ? (c.days as number[]).map((d) => DAY_NAMES[d]).join(", ")
                        : "Her gün"}
                    </span>
                    <span className="tabular">
                      Min. {fmtTL(c.minBasketCents)} · {c.redemptions}/{c.usageLimit ?? "∞"} kullanım
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <QrCode className="h-3.5 w-3.5 text-damping" /> {c.qrEnabled ? "QR aktif" : "QR kapalı"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-2 border-dashed border-damping/45 p-5">
            <Stamp>Onay mekanizması</Stamp>
            <p className="mt-3.5 text-[0.85rem] leading-relaxed text-murekkep-soft">
              <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-damping" />
              AI yalnızca kampanya <em>önerir</em>. İndirim oranı, geçerlilik ve limitler siz onaylamadan
              yayınlanmaz; kasiyerler bu kuralları değiştiremez.
            </p>
            <p className="mt-3 text-[0.78rem] text-sicak-gri">
              Kampanya başlangıcı: {fmtDate(new Date())} · Kurallar sunucu tarafında doğrulanır.
            </p>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

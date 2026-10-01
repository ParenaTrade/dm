import PanelShell from "@/components/PanelShell";
import { panelContext } from "@/lib/panel";
import { getBusinessBundle, getBusinesses } from "@/lib/queries";
import { MapSketch, Pill, SectionTitle, StatCard, Stamp } from "@/components/ui";
import ProfileForm from "@/components/ProfileForm";
import { DAY_NAMES, fmtTL, isOpenNow, openLabel } from "@/lib/format";
import { Check, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VitrinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [bundle, allBiz] = await Promise.all([getBusinessBundle(ctx.biz), getBusinesses()]);
  const canEdit = ctx.role !== "CASHIER";
  const now = new Date();

  return (
    <PanelShell ctx={ctx} active="vitrin" businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}>
      <SectionTitle
        eyebrow="Dijital Vitrin"
        title="İşletmenin internetteki karşılığı."
        note="Bu sayfada yazdıklarınız doğrudan /isletme/… dijital vitrininize ve arama motoru sonuçlarına yansır."
        action={
          <a
            href={`/isletme/${ctx.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border-2 border-murekkep px-5 py-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] hover:bg-murekkep hover:text-kagit"
          >
            Vitrini görüntüle
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Görüntülenme" value="2.840" sub="Son 30 gün · işletme sayfası" accent />
        <StatCard label="Puan" value={ctx.biz.rating.toFixed(1)} sub={`${ctx.biz.reviewCount} müşteri yorumu`} />
        <StatCard label="Ürün / hizmet" value={String(bundle.products.length + bundle.services.length)} sub="Vitrinde listelenen" />
        <StatCard label="Durum" value={openLabel(bundle.hours, now)} sub={`${bundle.campaigns.length} aktif kampanya`} />
      </div>

      <div className="mt-8">
        <ProfileForm
          business={{
            id: ctx.biz.id,
            name: ctx.biz.name,
            description: ctx.biz.description,
            story: ctx.biz.story,
            phone: ctx.biz.phone,
            whatsapp: ctx.biz.whatsapp,
            instagram: ctx.biz.instagram,
            website: ctx.biz.website,
            address: ctx.biz.address,
            subCategory: ctx.biz.subCategory,
          }}
          actorEmail={ctx.actorEmail}
          canEdit={canEdit}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Çalışma saatleri */}
        <div className="border-2 border-murekkep/12 bg-white/55">
          <div className="border-b-2 border-murekkep/12 px-6 py-4">
            <h2 className="font-display text-[1.18rem] font-bold">Çalışma saatleri</h2>
            <p className="mt-1.5 text-[0.82rem] text-murekkep-soft">
              Vitrinde “Açık / Kapalı” bilgisi bu tablodan hesaplanır.
            </p>
          </div>
          <table className="w-full text-[0.86rem]">
            <tbody>
              {bundle.hours.map((h) => (
                <tr key={h.id} className={`border-b border-murekkep/10 ${h.dayOfWeek === now.getDay() ? "bg-damping-soft/40" : ""}`}>
                  <td className="px-6 py-2.5 font-semibold">{DAY_NAMES[h.dayOfWeek]}</td>
                  <td className="tabular px-6 py-2.5 text-right">
                    {h.closed ? "Kapalı" : `${h.opensAt} – ${h.closesAt}`}
                  </td>
                  <td className="px-6 py-2.5 text-right">
                    {h.closed ? (
                      <X className="ml-auto h-4 w-4 text-damping" />
                    ) : (
                      <Check className="ml-auto h-4 w-4 text-[#1f6f4a]" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <MapSketch district={ctx.biz.district} city={ctx.biz.city} />

          <div className="border-2 border-murekkep/12 bg-white/55 p-6">
            <h2 className="font-display text-[1.12rem] font-bold">Vitrinde listelenenler</h2>
            <ul className="mt-4 space-y-3">
              {bundle.products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 border-b border-dashed border-murekkep/20 pb-3">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-[0.78rem] text-murekkep-soft">{p.description}</p>
                  </div>
                  <div className="text-right">
                    {p.discountPriceCents ? (
                      <p className="tabular text-[0.75rem] text-sicak-gri line-through">{fmtTL(p.priceCents)}</p>
                    ) : null}
                    <p className="tabular font-semibold">{fmtTL(p.discountPriceCents ?? p.priceCents)}</p>
                  </div>
                </li>
              ))}
              {bundle.services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 border-b border-dashed border-murekkep/20 pb-3">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-[0.78rem] text-murekkep-soft">{s.description}</p>
                  </div>
                  <p className="tabular font-semibold">{s.priceCents > 0 ? fmtTL(s.priceCents) : "Ücretsiz"}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-2 border-dashed border-damping/45 p-5">
            <Stamp>SEO</Stamp>
            <p className="mt-3.5 text-[0.85rem] leading-relaxed text-murekkep-soft">
              Vitrin sayfanız <span className="tabular text-murekkep">/isletme/{ctx.slug}</span> adresinde,
              “{ctx.biz.district} {ctx.biz.category}” aramalarına uygun başlık, açıklama ve yapılandırılmış veri
              (LocalBusiness) ile yayınlanır.
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {[
                `${ctx.biz.district} ${ctx.biz.category}`,
                `${ctx.biz.district} kampanya`,
                `${ctx.biz.district} indirim`,
              ].map((k) => (
                <Pill key={k} tone="neutral">{k}</Pill>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

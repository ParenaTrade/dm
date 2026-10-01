import PanelShell from "@/components/PanelShell";
import { panelContext } from "@/lib/panel";
import { getBusinesses, getPlanForBusiness } from "@/lib/queries";
import { Pill, SectionTitle, StatCard } from "@/components/ui";
import { PlanGenerator } from "@/components/AiStudio";
import { sectorLabel } from "@/lib/ai";
import { Check, Circle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [planData, allBiz] = await Promise.all([getPlanForBusiness(ctx.biz.id), getBusinesses()]);
  const days = planData?.days ?? [];
  const doneCount = days.filter((d) => d.done).length;

  return (
    <PanelShell ctx={ctx} active="plan" businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}>
      <SectionTitle
        eyebrow="Pazarlama Takvimi"
        title="28 günlük DampingVar pazarlama planı."
        note="Plan sektöre göre değişir: restoran ile yapı market aynı içerik planını kullanmaz. Her gün için tema, görev, kanal ve CTA önerilir."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="ink">{sectorLabel(ctx.biz.sectorKey)}</Pill>
            <PlanGenerator slug={ctx.slug} actorEmail={ctx.actorEmail} />
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tamamlanan gün" value={`${doneCount}/28`} sub="İşaretlediğiniz görevler" accent />
        <StatCard label="Plan durumu" value={planData?.plan.status ?? "YOK"} sub="AI tarafından üretildi" />
        <StatCard label="Hedef" value={planData?.plan.goal ?? "—"} sub="Plan bu hedefe göre kurgulandı" />
        <StatCard label="Sektör" value={sectorLabel(ctx.biz.sectorKey)} sub="İçerik temaları buna göre değişir" />
      </div>

      {days.length === 0 ? (
        <div className="border-2 border-dashed border-murekkep/25 p-12 text-center">
          <p className="font-display text-[1.55rem] font-bold">Henüz bir plan oluşturulmadı.</p>
          <p className="mx-auto mt-2.5 max-w-[52ch] text-[0.92rem] leading-relaxed text-murekkep-soft">
            “AI ile 28 günlük plan oluştur” düğmesine bastığınızda asistan; sektörünüze, lokasyonunuza ve
            geçmiş performansınıza göre günlük görevler hazırlar.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {days.map((d) => (
            <article
              key={d.id}
              className={`anim-rise border-2 p-4 ${
                d.done ? "border-damping bg-damping-soft/35" : "border-murekkep/12 bg-white/55"
              }`}
              style={{ animationDelay: `${Math.min(d.day, 12) * 28}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="tabular text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-damping">
                    Gün {String(d.day).padStart(2, "0")}
                  </p>
                  <h3 className="mt-1.5 font-display text-[1.02rem] font-bold leading-snug">{d.theme}</h3>
                </div>
                {d.done ? (
                  <Check className="h-4 w-4 shrink-0 text-damping" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-murekkep/25" />
                )}
              </div>
              <p className="mt-2.5 text-[0.82rem] leading-relaxed text-murekkep-soft">{d.task}</p>
              <div className="mt-3.5 border-t border-dashed border-murekkep/25 pt-3">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-murekkep">
                  {d.channel}
                </p>
                <p className="mt-1.5 text-[0.76rem] italic leading-relaxed text-sicak-gri">“{d.cta}”</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

import PanelShell from "@/components/PanelShell";
import { panelContext } from "@/lib/panel";
import { getAiContents, getBusinesses } from "@/lib/queries";
import { Pill, SectionTitle, StatCard } from "@/components/ui";
import AiStudio from "@/components/AiStudio";
import { sectorLabel } from "@/lib/ai";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await panelContext(sp);
  const [contents, allBiz] = await Promise.all([getAiContents(ctx.biz.id), getBusinesses()]);

  return (
    <PanelShell ctx={ctx} active="ai" businesses={allBiz.map((b) => ({ slug: b.slug, name: b.name }))}>
      <SectionTitle
        eyebrow="AI Pazarlama Asistanı"
        title={`${ctx.biz.name} için pazarlama uzmanı.`}
        note="Karmaşık bir AI ekranı yok. Hedefini yaz, gerisini asistan halletsin: kampanya, içerik, reklam, video senaryosu ve performans analizi."
        action={
          <div className="flex flex-wrap gap-2">
            <Pill tone="ink">
              <Sparkles className="h-3 w-3" /> {sectorLabel(ctx.biz.sectorKey)}
            </Pill>
            <Pill tone="amber">{ctx.biz.planCode} paketi</Pill>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Üretilen içerik" value={String(contents.length)} sub="Tüm zamanlar" accent />
        <StatCard label="Taslak bekleyen" value={String(contents.filter((c) => c.status === "DRAFT").length)} sub="Onayınızı bekliyor" />
        <StatCard label="Yayında" value={String(contents.filter((c) => c.status === "PUBLISHED").length)} sub="Onaylanmış içerik" />
        <StatCard label="AI aylık kota" value="120 üretim" sub="PRO paket · ay başında yenilenir" />
      </div>

      <AiStudio
        slug={ctx.slug}
        actorEmail={ctx.actorEmail}
        canApprove={ctx.role !== "CASHIER"}
        existing={contents.map((c) => ({
          id: c.id,
          kind: c.kind,
          platform: c.platform,
          title: c.title,
          body: c.body,
          cta: c.cta,
          variant: c.variant,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </PanelShell>
  );
}

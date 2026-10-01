import {
  analysePerformance,
  buildMarketingPlan,
  generateAdVariants,
  generateSocial,
  generateStory,
  generateVideoScript,
  suggestCampaign,
  weeklyReport,
} from "@/lib/ai";
import { buildSnapshot } from "@/lib/snapshot";
import { getBusinessBySlug, getBusinessStats } from "@/lib/queries";
import { resolveActor, can, deny } from "@/lib/auth";
import { logAudit } from "@/lib/finance";
import { db } from "@/db";
import { aiContents, marketingPlanDays, marketingPlans } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const slug: string = body.slug;
  const action: string = body.action ?? "social";
  const actorEmail: string = body.actorEmail ?? "";

  const biz = await getBusinessBySlug(slug);
  if (!biz) return Response.json({ ok: false, error: "İşletme bulunamadı." }, { status: 404 });

  const actor = await resolveActor(biz.id, actorEmail);
  if (!actor) return Response.json({ ok: false, error: "Yetkili personel bulunamadı." }, { status: 401 });
  if (action !== "durum" && !can(actor.role, "ai.generate")) return deny(actor.role, "ai.generate");

  const snapshot = await buildSnapshot(biz);
  const goal = String(body.goal ?? "Bu hafta müşteri sayısını artırmak istiyorum.");

  if (action === "kampanya") {
    const suggestion = suggestCampaign(snapshot, goal);
    const [row] = await db
      .insert(aiContents)
      .values({
        businessId: biz.id,
        kind: "CAMPAIGN",
        platform: "DampingVar",
        title: suggestion.title,
        body: `${suggestion.description}\n\nHedef kitle: ${suggestion.audience}\n\nÖlçüm gerekçesi: ${suggestion.rationale}`,
        cta: "Kampanyayı incele",
        variant: "ÖNERİ",
        meta: { ...suggestion },
        status: "DRAFT",
      })
      .returning();
    await logAudit(actor.email, actor.role, "AI_CAMPAIGN_GENERATED", "ai_contents", row.id, { goal });
    return Response.json({ ok: true, suggestion, content: row });
  }

  if (action === "sosyal") {
    const platform = String(body.platform ?? "Instagram");
    const content = generateSocial(snapshot, platform);
    const [row] = await db
      .insert(aiContents)
      .values({ ...content, businessId: biz.id, status: "DRAFT" })
      .returning();
    return Response.json({ ok: true, content: row });
  }

  if (action === "story") {
    const content = generateStory(snapshot);
    const [row] = await db
      .insert(aiContents)
      .values({ ...content, businessId: biz.id, status: "DRAFT" })
      .returning();
    return Response.json({ ok: true, content: row });
  }

  if (action === "reklam") {
    const variants = generateAdVariants(snapshot);
    const rows = [];
    for (const v of variants) {
      const [row] = await db
        .insert(aiContents)
        .values({
          businessId: biz.id,
          kind: "AD",
          platform: "DampingVar Reklam Ağı",
          title: `${v.variant} — ${v.angle}`,
          body: `${v.headline}\n\n${v.body}`,
          cta: "Kampanyayı incele",
          variant: v.variant,
          meta: { angle: v.angle, headline: v.headline },
          status: "DRAFT",
        })
        .returning();
      rows.push(row);
    }
    return Response.json({ ok: true, variants: rows });
  }

  if (action === "video") {
    const script = generateVideoScript(snapshot, body.focus ? String(body.focus) : undefined);
    const [row] = await db
      .insert(aiContents)
      .values({
        businessId: biz.id,
        kind: "VIDEO",
        platform: "Instagram Reels / TikTok",
        title: script.title,
        body: script.scenes.map((s) => `${s.time} — ${s.visual}\nSeslendirme: ${s.voiceover}`).join("\n\n"),
        cta: script.cta,
        meta: { durationSec: script.durationSec, scenes: script.scenes },
        status: "DRAFT",
      })
      .returning();
    return Response.json({ ok: true, script, content: row });
  }

  if (action === "plan") {
    const existing = await db.select().from(marketingPlans).where(eq(marketingPlans.businessId, biz.id));
    if (existing[0]) {
      await db.delete(marketingPlanDays).where(eq(marketingPlanDays.planId, existing[0].id));
      await db.delete(marketingPlans).where(eq(marketingPlans.id, existing[0].id));
    }
    const [plan] = await db
      .insert(marketingPlans)
      .values({
        businessId: biz.id,
        title: `28 Günlük DampingVar Pazarlama Planı — ${biz.district}`,
        goal,
        sectorKey: biz.sectorKey,
        status: "ACTIVE",
      })
      .returning();
    const days = buildMarketingPlan(snapshot);
    for (const d of days) {
      await db.insert(marketingPlanDays).values({
        planId: plan.id,
        day: d.day,
        theme: d.theme,
        task: d.task,
        channel: d.channel,
        caption: `${d.theme} — ${biz.name}, ${biz.district}`,
        cta: d.cta,
        done: false,
      });
    }
    await logAudit(actor.email, actor.role, "AI_PLAN_GENERATED", "marketing_plans", plan.id, { goal });
    return Response.json({ ok: true, plan, days });
  }

  if (action === "analiz") {
    return Response.json({ ok: true, bullets: analysePerformance(snapshot) });
  }

  if (action === "rapor") {
    return Response.json({ ok: true, report: weeklyReport(snapshot) });
  }

  if (action === "onayla" || action === "yayinla" || action === "reddet") {
    const id = String(body.contentId);
    const status = action === "onayla" ? "APPROVED" : action === "yayinla" ? "PUBLISHED" : "REJECTED";
    if (!can(actor.role, "content.approve")) return deny(actor.role, "content.approve");
    const [row] = await db
      .update(aiContents)
      .set({ status, approvedAt: action === "reddet" ? null : new Date() })
      .where(eq(aiContents.id, id))
      .returning();
    await logAudit(actor.email, actor.role, `AI_CONTENT_${status}`, "ai_contents", id, {});
    return Response.json({ ok: true, content: row });
  }

  if (action === "sil") {
    await db.delete(aiContents).where(eq(aiContents.id, String(body.contentId)));
    await logAudit(actor.email, actor.role, "AI_CONTENT_DELETED", "ai_contents", String(body.contentId), {});
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "Bilinmeyen AI işlemi." }, { status: 400 });
}

export async function GET() {
  return Response.json({
    ok: true,
    provider: "local-template-engine",
    model: "dampingvar-marketing-v1",
    note: "API anahtarları yalnızca sunucu tarafında okunur.",
  });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const biz = await getBusinessBySlug(String(body.slug ?? ""));
  if (!biz) return Response.json({ ok: false, error: "İşletme bulunamadı." }, { status: 404 });
  const stats = await getBusinessStats(biz.id);
  return Response.json({ ok: true, stats });
}

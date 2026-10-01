import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { campaigns, businesses, qrCodes, users, dampingWallets } from "@/db/schema";
import { resolveActor, can, deny } from "@/lib/auth";
import { logAudit } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  const rows = businessId
    ? await db.select().from(campaigns).where(eq(campaigns.businessId, businessId)).orderBy(desc(campaigns.createdAt))
    : await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(40);
  return Response.json({ ok: true, campaigns: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const businessId: string = body.businessId;
  const actor = await resolveActor(businessId, body.actorEmail ?? "");
  if (!actor) return Response.json({ ok: false, error: "Yetkili personel bulunamadı." }, { status: 401 });
  if (!can(actor.role, "campaign.write")) return deny(actor.role, "campaign.write");

  const title = String(body.title ?? "").trim();
  if (title.length < 3) return Response.json({ ok: false, error: "Kampanya başlığı en az 3 karakter olmalı." }, { status: 400 });

  // Finansal oranlar sunucuda sınırlandırılır (frontend'e güvenilmez)
  const discountPercent = Math.max(0, Math.min(60, Number(body.discountPercent ?? 0)));
  const discountAmountCents = Math.max(0, Math.min(500000, Math.round(Number(body.discountAmountCents ?? 0))));
  const minBasketCents = Math.max(0, Math.round(Number(body.minBasketCents ?? 0)));
  const maxDiscountCents = Math.max(0, Math.round(Number(body.maxDiscountCents ?? 0)));

  const code = `DMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const [row] = await db
    .insert(campaigns)
    .values({
      businessId,
      code,
      title,
      description: String(body.description ?? ""),
      type: String(body.type ?? "PERCENT"),
      discountPercent,
      discountAmountCents,
      minBasketCents,
      maxDiscountCents,
      usageLimit: body.usageLimit ? Math.max(1, Math.round(Number(body.usageLimit))) : null,
      perCustomerLimit: Math.max(1, Math.round(Number(body.perCustomerLimit ?? 1))),
      startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      timeStart: body.timeStart || null,
      timeEnd: body.timeEnd || null,
      days: Array.isArray(body.days) ? body.days.map(Number) : [],
      status: "PUBLISHED",
      qrEnabled: body.qrEnabled !== false,
    })
    .returning();

  // Kampanya QR'ı
  await db.insert(qrCodes).values({
    code: `QR-${code}`,
    businessId,
    campaignId: row.id,
    customerId: null,
    status: "ACTIVE",
  });

  await logAudit(actor.email, actor.role, "CAMPAIGN_CREATED", "campaigns", row.id, { title, discountPercent });

  return Response.json({ ok: true, campaign: row });
}

/** Kasada kod / QR çözümleme — işletme, kampanya, müşteri doğrulaması */
export async function PUT(req: Request) {
  const body = await req.json();
  const code = String(body.code ?? "").trim();
  if (!code) return Response.json({ ok: false, error: "Kod gerekli." }, { status: 400 });

  const qrRows = await db.select().from(qrCodes).where(eq(qrCodes.code, code)).limit(1);
  const qr = qrRows[0] ?? null;

  const campaignCode = qr?.campaignId ? undefined : code;
  let campaign = null;
  if (qr?.campaignId) {
    campaign = (await db.select().from(campaigns).where(eq(campaigns.id, qr.campaignId)).limit(1))[0] ?? null;
  } else if (campaignCode) {
    campaign = (await db.select().from(campaigns).where(eq(campaigns.code, campaignCode)).limit(1))[0] ?? null;
  }

  if (!qr && !campaign) {
    return Response.json({ ok: false, error: "Geçersiz kod. QR veya kampanya kodunu kontrol edin." }, { status: 404 });
  }

  const businessId = qr?.businessId ?? campaign?.businessId ?? null;
  const business = businessId
    ? (await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1))[0] ?? null
    : null;

  let customer = null;
  let wallet = null;
  if (qr?.customerId) {
    customer = (await db.select().from(users).where(eq(users.id, qr.customerId)).limit(1))[0] ?? null;
    wallet = (await db.select().from(dampingWallets).where(eq(dampingWallets.userId, qr.customerId)).limit(1))[0] ?? null;
  }

  return Response.json({
    ok: true,
    qr,
    campaign,
    business,
    customer,
    wallet,
    alreadyUsed: qr?.status === "REDEEMED",
  });
}

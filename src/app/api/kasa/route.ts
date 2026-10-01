import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  businessContracts,
  campaigns,
  qrCodes,
  transactions,
  users,
  dampingWallets,
} from "@/db/schema";
import { completeSale, priceTransaction, validateCampaignUsage, reverseTransaction } from "@/lib/finance";
import { resolveActor, can, deny } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Sunucu tarafı fiyatlandırma önizlemesi — hiçbir finansal değer istemciye güvenilmez */
export async function POST(req: Request) {
  const body = await req.json();
  const action = String(body.action ?? "onizleme");

  if (action === "onizleme") {
    const businessId: string = body.businessId;
    const gross = Math.max(0, Math.round(Number(body.grossAmountCents ?? 0)));
    const contractRows = await db
      .select()
      .from(businessContracts)
      .where(eq(businessContracts.businessId, businessId));
    const contract = contractRows[0];
    if (!contract) return Response.json({ ok: false, error: "Sözleşme bulunamadı." }, { status: 400 });

    let campaign = null;
    if (body.campaignId) {
      campaign = (await db.select().from(campaigns).where(eq(campaigns.id, body.campaignId)).limit(1))[0] ?? null;
    } else if (body.code) {
      campaign = (await db.select().from(campaigns).where(eq(campaigns.code, body.code)).limit(1))[0] ?? null;
    }

    const issues = validateCampaignUsage(campaign, Number(campaign?.redemptions ?? 0));

    // İstemcinin istediği damping tutarı bakiyeyle sınırlandırılır
    let dampingRequested = Math.max(0, Math.round(Number(body.dampingUseCents ?? 0)));
    if (body.customerId) {
      const w = (await db.select().from(dampingWallets).where(eq(dampingWallets.userId, body.customerId)).limit(1))[0];
      dampingRequested = Math.min(dampingRequested, w?.availableCents ?? 0);
    }

    const breakdown = priceTransaction({
      grossAmountCents: gross,
      campaign,
      contract,
      dampingUsedCents: dampingRequested,
    });

    return Response.json({ ok: true, breakdown, issues, campaign, commissionBase: contract.commissionBase });
  }

  if (action === "tamamla") {
    const businessId: string = body.businessId;
    const actor = await resolveActor(businessId, body.actorEmail ?? "");
    if (!actor) return Response.json({ ok: false, error: "Yetkili personel bulunamadı." }, { status: 401 });
    if (!can(actor.role, "kasa.sell")) return deny(actor.role, "kasa.sell");

    const result = await completeSale({
      businessId,
      campaignId: body.campaignId ?? null,
      code: body.code ?? null,
      grossAmountCents: Math.round(Number(body.grossAmountCents ?? 0)),
      dampingUseCents: Math.round(Number(body.dampingUseCents ?? 0)),
      paymentMethod: body.paymentMethod ?? "NAKIT",
      actorEmail: actor.email,
      actorRole: actor.role,
      note: body.note ?? null,
    });
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === "iade") {
    const actor = await resolveActor(body.businessId ?? "", body.actorEmail ?? "");
    if (!actor) return Response.json({ ok: false, error: "Yetkili personel bulunamadı." }, { status: 401 });
    if (!can(actor.role, "transaction.reverse")) return deny(actor.role, "transaction.reverse");
    const res = await reverseTransaction(String(body.transactionId), actor.email, String(body.reason ?? "İade"));
    return Response.json(res, { status: res.ok ? 200 : 400 });
  }

  return Response.json({ ok: false, error: "Bilinmeyen işlem." }, { status: 400 });
}

/** Son işlemler (kasiyerin kendi akışı) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  if (!businessId) return Response.json({ ok: false, error: "businessId gerekli." }, { status: 400 });
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.businessId, businessId))
    .limit(15);
  const customers = await db.select().from(users).limit(50);
  const qrs = await db.select().from(qrCodes).where(eq(qrCodes.businessId, businessId)).limit(20);
  return Response.json({
    ok: true,
    transactions: rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    customers,
    qrs,
  });
}

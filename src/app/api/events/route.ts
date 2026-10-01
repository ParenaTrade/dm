import { recordEvent } from "@/lib/queries";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "business_view",
  "campaign_view",
  "campaign_click",
  "offer_view",
  "qr_generated",
  "qr_scanned",
  "qr_redeemed",
  "transaction_started",
  "transaction_completed",
  "referral_signup",
  "referral_purchase",
  "damping_earned",
  "damping_spent",
  "ad_impression",
  "ad_click",
  "filter_used",
]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind ?? "");
  if (!ALLOWED.has(kind)) return Response.json({ ok: false, error: "Geçersiz olay türü." }, { status: 400 });
  await recordEvent(kind, body.businessId ?? null, body.campaignId ?? null, body.userId ?? null, {
    ...(body.meta ?? {}),
  });
  return Response.json({ ok: true });
}

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { resolveActor, can, deny } from "@/lib/auth";
import { logAudit } from "@/lib/finance";

export const dynamic = "force-dynamic";

const EDITABLE = [
  "name",
  "description",
  "story",
  "phone",
  "whatsapp",
  "instagram",
  "website",
  "address",
  "subCategory",
  "logoText",
] as const;

export async function POST(req: Request) {
  const body = await req.json();
  const businessId: string = body.businessId;
  const actor = await resolveActor(businessId, body.actorEmail ?? "");
  if (!actor) return Response.json({ ok: false, error: "Yetkili personel bulunamadı." }, { status: 401 });
  if (!can(actor.role, "settings.write")) return deny(actor.role, "settings.write");

  const patch: Record<string, string> = {};
  for (const key of EDITABLE) {
    if (typeof body[key] === "string") patch[key] = body[key].slice(0, 1200);
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: false, error: "Güncellenecek alan yok." }, { status: 400 });
  }

  const [row] = await db.update(businesses).set(patch).where(eq(businesses.id, businessId)).returning();
  await logAudit(actor.email, actor.role, "BUSINESS_UPDATED", "businesses", businessId, { fields: Object.keys(patch) });
  return Response.json({ ok: true, business: row });
}

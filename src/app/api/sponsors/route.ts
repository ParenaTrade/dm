import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sponsors } from "@/db/schema";
import { safeHttpUrl } from "@/lib/affiliate";
import { ensureSeed } from "@/lib/seed";
import { getCurrentUser, isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function shape(r: typeof sponsors.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    logoUrl: r.logoUrl,
    description: r.description,
    clickParam: r.clickParam,
    active: r.active,
    orderIndex: r.orderIndex,
  };
}

/** Yayıncı ve moderatör: sponsor listesi (moderatör yalnız seçer). */
export async function GET() {
  await ensureSeed();
  const me = await getCurrentUser();
  if (!isStaff(me)) return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  const rows = await db.select().from(sponsors).orderBy(asc(sponsors.orderIndex), asc(sponsors.id));
  const list = me?.role === "host" ? rows : rows.filter((r) => r.active);
  return Response.json({ ok: true, sponsors: list.map(shape) });
}

type Body = {
  name?: string;
  url?: string;
  logoUrl?: string;
  description?: string;
  clickParam?: string;
  active?: boolean;
  orderIndex?: number;
};

function clean(body: Body, partial: boolean) {
  const out: Partial<typeof sponsors.$inferInsert> = {};
  if (body.name !== undefined || !partial) out.name = (body.name ?? "").trim().slice(0, 60);
  if (body.url !== undefined || !partial) {
    const safe = safeHttpUrl(body.url ?? "");
    out.url = safe ?? "";
  }
  if (body.logoUrl !== undefined) out.logoUrl = body.logoUrl.trim().slice(0, 600);
  if (body.description !== undefined) out.description = body.description.trim().slice(0, 300);
  if (body.clickParam !== undefined) out.clickParam = body.clickParam.trim().replace(/[^\w-]/g, "").slice(0, 20) || "subid";
  if (body.active !== undefined) out.active = Boolean(body.active);
  if (body.orderIndex !== undefined) out.orderIndex = Math.trunc(Number(body.orderIndex) || 0);
  return out;
}

async function hostOnly() {
  const me = await getCurrentUser();
  return me && me.role === "host" ? me : null;
}

/** Yalnızca admin: sponsor ekler. */
export async function POST(request: Request) {
  await ensureSeed();
  if (!(await hostOnly())) return Response.json({ ok: false, error: "Sadece yayıncı sponsor ekleyebilir." }, { status: 403 });
  const body: Body = await request.json().catch(() => ({}));
  const data = clean(body, false);
  if (!data.name || !data.url) return Response.json({ ok: false, error: "Ad ve geçerli site adresi gerekli." }, { status: 400 });
  const [row] = await db.insert(sponsors).values(data as typeof sponsors.$inferInsert).returning();
  return Response.json({ ok: true, sponsor: shape(row) });
}

/** Yalnızca admin: sponsor günceller. */
export async function PUT(request: Request) {
  await ensureSeed();
  if (!(await hostOnly())) return Response.json({ ok: false, error: "Sadece yayıncı sponsor düzenleyebilir." }, { status: 403 });
  const body: Body & { id?: number } = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id)) return Response.json({ ok: false, error: "Geçersiz id" }, { status: 400 });
  const data = clean(body, true);
  if (data.url === "") return Response.json({ ok: false, error: "Geçerli site adresi gerekli." }, { status: 400 });
  if (data.name === "") return Response.json({ ok: false, error: "Ad boş olamaz." }, { status: 400 });
  if (Object.keys(data).length) await db.update(sponsors).set(data).where(eq(sponsors.id, id));
  return Response.json({ ok: true });
}

/** Yalnızca admin: sponsor siler. */
export async function DELETE(request: Request) {
  await ensureSeed();
  if (!(await hostOnly())) return Response.json({ ok: false, error: "Sadece yayıncı sponsor silebilir." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ ok: false, error: "Geçersiz id" }, { status: 400 });
  await db.delete(sponsors).where(eq(sponsors.id, id));
  return Response.json({ ok: true });
}

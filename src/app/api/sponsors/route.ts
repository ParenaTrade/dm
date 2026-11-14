import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sponsors } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { getCurrentUser, isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Yayıncı ve moderatör: sponsor listesini görür (moderatör sadece seçer). */
export async function GET() {
  await ensureSeed();
  const me = await getCurrentUser();
  if (!isStaff(me)) return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  const rows = await db.select().from(sponsors).orderBy(asc(sponsors.id));
  return Response.json({ ok: true, sponsors: rows.map((r) => ({ id: r.id, name: r.name, url: r.url })) });
}

/** Yalnızca admin (yayıncı): sponsor ekler. */
export async function POST(request: Request) {
  await ensureSeed();
  const me = await getCurrentUser();
  if (!me || me.role !== "host") {
    return Response.json({ ok: false, error: "Sadece yayıncı sponsor ekleyebilir." }, { status: 403 });
  }
  const body: { name?: string; url?: string } = await request.json().catch(() => ({}));
  const name = (body.name ?? "").trim().slice(0, 60);
  let url = (body.url ?? "").trim().slice(0, 500);
  if (!name || !url) return Response.json({ ok: false, error: "Ad ve adres gerekli." }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    new URL(url);
  } catch {
    return Response.json({ ok: false, error: "Geçersiz site adresi." }, { status: 400 });
  }
  const [row] = await db.insert(sponsors).values({ name, url }).returning();
  return Response.json({ ok: true, sponsor: { id: row.id, name: row.name, url: row.url } });
}

/** Yalnızca admin (yayıncı): sponsor siler. */
export async function DELETE(request: Request) {
  await ensureSeed();
  const me = await getCurrentUser();
  if (!me || me.role !== "host") {
    return Response.json({ ok: false, error: "Sadece yayıncı sponsor silebilir." }, { status: 403 });
  }
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ ok: false, error: "Geçersiz id" }, { status: 400 });
  await db.delete(sponsors).where(eq(sponsors.id, id));
  return Response.json({ ok: true });
}

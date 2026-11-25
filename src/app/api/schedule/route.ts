import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduleItems } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { id?: number; day?: string; time?: string; title?: string; category?: string; isLive?: boolean; orderIndex?: number };

async function hostOnly() {
  const me = await getCurrentUser();
  return me && me.role === "host" ? me : null;
}

export async function GET() {
  await ensureSeed();
  const rows = await db.select().from(scheduleItems).orderBy(asc(scheduleItems.orderIndex), asc(scheduleItems.id));
  return Response.json({ ok: true, items: rows });
}

function clean(b: Body, partial: boolean) {
  const out: Partial<typeof scheduleItems.$inferInsert> = {};
  if (b.day !== undefined || !partial) out.day = (b.day ?? "").trim().slice(0, 20);
  if (b.time !== undefined || !partial) out.time = (b.time ?? "").trim().slice(0, 10);
  if (b.title !== undefined || !partial) out.title = (b.title ?? "").trim().slice(0, 120);
  if (b.category !== undefined) out.category = b.category.trim().slice(0, 30) || "Sohbet";
  if (b.isLive !== undefined) out.isLive = Boolean(b.isLive);
  if (b.orderIndex !== undefined) out.orderIndex = Math.trunc(Number(b.orderIndex) || 0);
  return out;
}

export async function POST(request: Request) {
  await ensureSeed();
  if (!(await hostOnly())) return Response.json({ ok: false, error: "Sadece admin akış ekleyebilir." }, { status: 403 });
  const b: Body = await request.json().catch(() => ({}));
  const data = clean(b, false);
  if (!data.day || !data.time || !data.title) return Response.json({ ok: false, error: "Gün, saat ve başlık gerekli." }, { status: 400 });
  const [row] = await db.insert(scheduleItems).values(data as typeof scheduleItems.$inferInsert).returning();
  return Response.json({ ok: true, item: row });
}

export async function PUT(request: Request) {
  await ensureSeed();
  if (!(await hostOnly())) return Response.json({ ok: false, error: "Sadece admin akış düzenleyebilir." }, { status: 403 });
  const b: Body = await request.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isInteger(id)) return Response.json({ ok: false, error: "Geçersiz id" }, { status: 400 });
  const data = clean(b, true);
  if (data.day === "" || data.time === "" || data.title === "") return Response.json({ ok: false, error: "Gün, saat ve başlık boş olamaz." }, { status: 400 });
  if (Object.keys(data).length) await db.update(scheduleItems).set(data).where(eq(scheduleItems.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  await ensureSeed();
  if (!(await hostOnly())) return Response.json({ ok: false, error: "Sadece admin akış silebilir." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ ok: false, error: "Geçersiz id" }, { status: 400 });
  await db.delete(scheduleItems).where(eq(scheduleItems.id, id));
  return Response.json({ ok: true });
}

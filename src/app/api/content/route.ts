import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { siteItems } from "@/db/schema";
import { safeHttpUrl } from "@/lib/affiliate";
import { ensureSeed } from "@/lib/seed";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KINDS = ["promo", "game", "match"];

type Body = {
  id?: number;
  kind?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  imageUrl?: string;
  linkUrl?: string;
  sponsorId?: number | null;
  badge?: string;
  terms?: string;
  placement?: string;
  startsAt?: string | null;
  active?: boolean;
  orderIndex?: number;
};

function shape(r: typeof siteItems.$inferSelect) {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    subtitle: r.subtitle,
    body: r.body,
    imageUrl: r.imageUrl,
    linkUrl: r.linkUrl,
    sponsorId: r.sponsorId,
    badge: r.badge,
    terms: r.terms,
    placement: r.placement,
    startsAt: r.startsAt ? r.startsAt.toISOString() : null,
    active: r.active,
    orderIndex: r.orderIndex,
  };
}

async function hostOnly() {
  const me = await getCurrentUser();
  return me && me.role === "host" ? me : null;
}

function clean(b: Body, partial: boolean) {
  const out: Partial<typeof siteItems.$inferInsert> = {};
  if (b.title !== undefined || !partial) out.title = (b.title ?? "").trim().slice(0, 120);
  if (b.subtitle !== undefined) out.subtitle = b.subtitle.trim().slice(0, 160);
  if (b.body !== undefined) out.body = b.body.trim().slice(0, 600);
  if (b.imageUrl !== undefined) out.imageUrl = b.imageUrl.trim().slice(0, 600);
  if (b.linkUrl !== undefined) {
    const raw = b.linkUrl.trim();
    out.linkUrl = raw ? (safeHttpUrl(raw) ?? "") : "";
  }
  if (b.sponsorId !== undefined) out.sponsorId = b.sponsorId ? Number(b.sponsorId) : null;
  if (b.badge !== undefined) out.badge = b.badge.trim().slice(0, 30);
  if (b.terms !== undefined) out.terms = b.terms.trim().slice(0, 500);
  if (b.placement !== undefined) out.placement = ["all", "oyun", "mac", "sohbet"].includes(b.placement) ? b.placement : "all";
  if (b.startsAt !== undefined) {
    const d = b.startsAt ? new Date(b.startsAt) : null;
    out.startsAt = d && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (b.active !== undefined) out.active = Boolean(b.active);
  if (b.orderIndex !== undefined) out.orderIndex = Math.trunc(Number(b.orderIndex) || 0);
  return out;
}

/** GET ?kind=promo|game|match  — admin hepsini, herkes yalnız aktifleri görür. */
export async function GET(request: Request) {
  await ensureSeed();
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  if (!KINDS.includes(kind)) return Response.json({ ok: false, error: "Geçersiz tür" }, { status: 400 });
  const me = await getCurrentUser();
  const rows = await db.select().from(siteItems).where(eq(siteItems.kind, kind)).orderBy(asc(siteItems.orderIndex), asc(siteItems.id));
  const list = me?.role === "host" ? rows : rows.filter((r) => r.active);
  return Response.json({ ok: true, items: list.map(shape) });
}

export async function POST(request: Request) {
  await ensureSeed();
  if (!(await hostOnly())) return Response.json({ ok: false, error: "Sadece admin içerik ekleyebilir." }, { status: 403 });
  const b: Body = await request.json().catch(() => ({}));
  if (!b.kind || !KINDS.includes(b.kind)) return Response.json({ ok: false, error: "Geçersiz tür" }, { status: 400 });
  const data = clean(b, false);
  if (!data.title) return Response.json({ ok: false, error: "Başlık gerekli." }, { status: 400 });
  const [row] = await db.insert(siteItems).values({ ...(data as typeof siteItems.$inferInsert), kind: b.kind }).returning();
  return Response.json({ ok: true, item: shape(row) });
}

export async function PUT(request: Request) {
  await ensureSeed();
  if (!(await hostOnly())) return Response.json({ ok: false, error: "Sadece admin içerik düzenleyebilir." }, { status: 403 });
  const b: Body = await request.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isInteger(id)) return Response.json({ ok: false, error: "Geçersiz id" }, { status: 400 });
  const data = clean(b, true);
  if (data.title === "") return Response.json({ ok: false, error: "Başlık boş olamaz." }, { status: 400 });
  if (Object.keys(data).length) await db.update(siteItems).set(data).where(eq(siteItems.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  await ensureSeed();
  if (!(await hostOnly())) return Response.json({ ok: false, error: "Sadece admin içerik silebilir." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ ok: false, error: "Geçersiz id" }, { status: 400 });
  await db.delete(siteItems).where(eq(siteItems.id, id));
  return Response.json({ ok: true });
}

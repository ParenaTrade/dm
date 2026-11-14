import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, siteImages } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { getCurrentUser, isStaff } from "@/lib/session";
import {
  IMAGES_BUCKET,
  IMAGES_FOLDER,
  IMAGE_SLOTS,
  SLOT_NAMES,
  getSiteImages,
  invalidateImageCache,
} from "@/lib/site-images";
import { SUPABASE_SERVICE_KEY, SUPABASE_URL, getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
const MAX_BYTES = 4 * 1024 * 1024; // Vercel istek sınırı ~4,5 MB

function storageClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return getSupabaseAdmin();
}

const NEED_KEY =
  "Görsel yüklemek için Vercel'de SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı (Supabase → Project Settings → API → service_role).";

/** Admin/moderatör: slot listesi ve mevcut görseller. */
export async function GET() {
  await ensureSeed();
  const me = await getCurrentUser();
  if (!isStaff(me)) return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });
  const map = await getSiteImages();
  return Response.json({
    ok: true,
    canEdit: me?.role === "host",
    storageReady: Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY),
    bucket: IMAGES_BUCKET,
    folder: IMAGES_FOLDER,
    slots: IMAGE_SLOTS.map((s) => ({
      slot: s.slot,
      label: s.label,
      hint: s.hint,
      url: map[s.slot]?.url ?? null,
      updatedAt: map[s.slot]?.updatedAt ?? null,
    })),
  });
}

/** Yalnızca admin: görsel ekle / değiştir (multipart: slot + file). */
export async function POST(request: Request) {
  await ensureSeed();
  const me = await getCurrentUser();
  if (!me || me.role !== "host") {
    return Response.json({ ok: false, error: "Sadece admin görsel yükleyebilir." }, { status: 403 });
  }
  const client = storageClient();
  if (!client) return Response.json({ ok: false, error: NEED_KEY }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const slot = String(form?.get("slot") ?? "");
  const file = form?.get("file");
  if (!SLOT_NAMES.includes(slot)) return Response.json({ ok: false, error: "Geçersiz görsel alanı." }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ ok: false, error: "Dosya seçilmedi." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ ok: false, error: "Yalnızca JPG, PNG, WebP, GIF veya AVIF yüklenebilir." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "Dosya en fazla 4 MB olabilir." }, { status: 400 });

  // Kova yoksa herkese açık olarak oluştur.
  const buckets = await client.storage.listBuckets();
  if (!buckets.error && !buckets.data.some((b) => b.name === IMAGES_BUCKET)) {
    const created = await client.storage.createBucket(IMAGES_BUCKET, { public: true });
    if (created.error) return Response.json({ ok: false, error: `Kova oluşturulamadı: ${created.error.message}` }, { status: 500 });
  }

  const path = `${IMAGES_FOLDER}/${slot}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const up = await client.storage.from(IMAGES_BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (up.error) return Response.json({ ok: false, error: `Yükleme başarısız: ${up.error.message}` }, { status: 500 });

  const url = client.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
  const previous = await db.select().from(siteImages).where(eq(siteImages.slot, slot)).limit(1);
  await db
    .insert(siteImages)
    .values({ slot, path, url })
    .onConflictDoUpdate({ target: siteImages.slot, set: { path, url, updatedAt: new Date() } });
  if (previous[0]?.path) await client.storage.from(IMAGES_BUCKET).remove([previous[0].path]);

  invalidateImageCache();
  await db.insert(activityLog).values({ actor: me.nickname, action: previous[0] ? "gorsel_degistirdi" : "gorsel_ekledi", target: slot });
  return Response.json({ ok: true, slot, url });
}

/** Yalnızca admin: görseli sil. */
export async function DELETE(request: Request) {
  await ensureSeed();
  const me = await getCurrentUser();
  if (!me || me.role !== "host") {
    return Response.json({ ok: false, error: "Sadece admin görsel silebilir." }, { status: 403 });
  }
  const slot = new URL(request.url).searchParams.get("slot") ?? "";
  if (!SLOT_NAMES.includes(slot)) return Response.json({ ok: false, error: "Geçersiz görsel alanı." }, { status: 400 });

  const rows = await db.select().from(siteImages).where(eq(siteImages.slot, slot)).limit(1);
  if (!rows[0]) return Response.json({ ok: true });
  const client = storageClient();
  if (client) await client.storage.from(IMAGES_BUCKET).remove([rows[0].path]);
  await db.delete(siteImages).where(eq(siteImages.slot, slot));
  invalidateImageCache();
  await db.insert(activityLog).values({ actor: me.nickname, action: "gorsel_sildi", target: slot });
  return Response.json({ ok: true });
}

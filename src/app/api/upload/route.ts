import { ensureSeed } from "@/lib/seed";
import { getCurrentUser } from "@/lib/session";
import { IMAGES_BUCKET } from "@/lib/site-images";
import { SUPABASE_SERVICE_KEY, SUPABASE_URL, getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};
const MAX_BYTES = 4 * 1024 * 1024;

/** Admin: sponsor logosu / promosyon / oyun / maç görseli yükler (images kovası, content klasörü). */
export async function POST(request: Request) {
  await ensureSeed();
  const me = await getCurrentUser();
  if (!me || me.role !== "host") return Response.json({ ok: false, error: "Sadece admin yükleyebilir." }, { status: 403 });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return Response.json({ ok: false, error: "Yükleme için SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı. Şimdilik görsel adresini yapıştırabilirsin." }, { status: 503 });
  }
  const client = getSupabaseAdmin();
  if (!client) return Response.json({ ok: false, error: "Depolama hazır değil." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "Dosya seçilmedi." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ ok: false, error: "JPG, PNG, WebP, GIF, AVIF veya SVG yükle." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "Dosya en fazla 4 MB olabilir." }, { status: 400 });

  const buckets = await client.storage.listBuckets();
  if (!buckets.error && !buckets.data.some((b) => b.name === IMAGES_BUCKET)) {
    await client.storage.createBucket(IMAGES_BUCKET, { public: true });
  }
  const path = `content/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await client.storage.from(IMAGES_BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (up.error) return Response.json({ ok: false, error: `Yükleme başarısız: ${up.error.message}` }, { status: 500 });
  const url = client.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
  return Response.json({ ok: true, url });
}

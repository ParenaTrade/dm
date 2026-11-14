import { db } from "@/db";
import { siteImages } from "@/db/schema";

/** Ana sayfada düzenlenebilen görsel alanları. */
export const IMAGE_SLOTS = [
  { slot: "logo", label: "Logo", hint: "Sol üst köşe, kare (örn. 256×256)" },
  { slot: "hero", label: "Açılış arka planı", hint: "Büyük arka plan görseli, yatay (örn. 1920×1080)" },
  { slot: "banner", label: "Canlı yayın kartı banner'ı", hint: "Kartın en üstünde, 16:9 yatay (örn. 1280×720)" },
  { slot: "studio", label: "Stüdyo bölümü görseli", hint: "4:3 yatay (örn. 1200×900)" },
  { slot: "casino", label: "Oyun / masa bölümü görseli", hint: "Yatay geniş görsel (örn. 1600×900)" },
  { slot: "community", label: "Berkbey ailesi arka planı", hint: "Yatay geniş görsel (örn. 1920×800)" },
] as const;

export type ImageSlot = (typeof IMAGE_SLOTS)[number]["slot"];
export const SLOT_NAMES: string[] = IMAGE_SLOTS.map((s) => s.slot);

export const IMAGES_BUCKET = process.env.SUPABASE_IMAGES_BUCKET || "images";
export const IMAGES_FOLDER = "site";

type ImageMap = Partial<Record<string, { url: string; path: string; updatedAt: string }>>;

let cache: { at: number; map: ImageMap } | null = null;

export function invalidateImageCache() {
  cache = null;
}

/** Ana sayfa görselleri (kısa süreli bellek önbelleği ile). Hata olursa boş döner. */
export async function getSiteImages(): Promise<ImageMap> {
  if (cache && Date.now() - cache.at < 15_000) return cache.map;
  try {
    const rows = await db.select().from(siteImages);
    const map: ImageMap = {};
    for (const row of rows) {
      map[row.slot] = { url: row.url, path: row.path, updatedAt: row.updatedAt.toISOString() };
    }
    cache = { at: Date.now(), map };
    return map;
  } catch {
    return {};
  }
}

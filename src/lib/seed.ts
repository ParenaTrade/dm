import { ensureDatabase } from "@/lib/bootstrap";

let logged = false;

/**
 * Geriye dönük uyumluluk: tüm API'ler çağrı öncesi şema + seed'in hazır
 * olmasını garantiler (Supabase'de tablolar otomatik oluşur).
 */
export async function ensureSeed(): Promise<void> {
  try {
    await ensureDatabase();
    if (!logged) {
      logged = true;
    }
  } catch (error) {
    console.error("bootstrap error", error);
  }
}

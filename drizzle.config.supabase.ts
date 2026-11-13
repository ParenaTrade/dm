import type { Config } from "drizzle-kit";
import { config } from "dotenv";

config();

/**
 * Supabase'e doğrudan şema push'u için:
 *   SUPABASE_DB_URL="postgresql://postgres.xxx:ŞİFRE@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
 *     npx drizzle-kit push --config drizzle.config.supabase.ts
 */
const raw = process.env.SUPABASE_DB_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

if (!raw) {
  throw new Error("SUPABASE_DB_URL (veya POSTGRES_URL / DATABASE_URL) tanımlı değil.");
}

// sslmode=require => verify-full gibi davranır ve self-signed zincirde patlar.
// Mevcut ssl parametrelerini temizleyip sertifika doğrulamasız (no-verify) TLS kullan.
const url = new URL(raw.trim());
for (const key of ["sslmode", "ssl", "sslrootcert", "uselibpqcompat", "supa", "pgbouncer"]) {
  url.searchParams.delete(key);
}
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
if (!isLocal) url.searchParams.set("sslmode", "no-verify");

export default {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: url.toString() },
} satisfies Config;

import type { Config } from "drizzle-kit";
import { config } from "dotenv";

config();

/**
 * Supabase'e doğrudan şema push'u için:
 *   SUPABASE_DB_URL="postgresql://postgres.xxx:ŞİFRE@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" \
 *     npx drizzle-kit push --config drizzle.config.supabase.ts
 */
const url = process.env.SUPABASE_DB_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("SUPABASE_DB_URL (veya POSTGRES_URL / DATABASE_URL) tanımlı değil.");
}

export default {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
    ssl: { rejectUnauthorized: false },
  },
} satisfies Config;

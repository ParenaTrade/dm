import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

/**
 * Bağlantı çözümleme (Vercel + Supabase uyumlu):
 *  1) SUPABASE_DB_URL          -> Supabase "Connection string" (pooler önerilir)
 *  2) POSTGRES_URL             -> Vercel/Supabase entegrasyon değişkeni
 *  3) DATABASE_URL             -> yerel geliştirme / genel yedek
 */
const RAW_URL =
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "";

if (!RAW_URL) {
  throw new Error(
    "Veritabanı bağlantısı bulunamadı. SUPABASE_DB_URL (veya DATABASE_URL) ortam değişkenini tanımla.",
  );
}

const parsed = new URL(RAW_URL);
const host = parsed.hostname;
const isSupabase =
  /supabase\.(co|com|net)$/i.test(host) || /pooler\.supabase/i.test(host) || Boolean(process.env.SUPABASE_DB_URL);
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";

/**
 * Supabase'de TLS zorunludur. Pooler (port 6543 / transaction mode) serverless
 * (Vercel) için önerilir; 5432 ise oturum modudur.
 */
const useSsl = !isLocal;
const sslConfig = useSsl ? { rejectUnauthorized: false } : undefined;

const pooler = parsed.port === "6543" || /pgbouncer=true/i.test(parsed.search || "");

const poolConfig: PoolConfig = {
  connectionString: RAW_URL,
  ssl: sslConfig,
  max: isLocal ? 10 : 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 12_000,
  // PgBouncer transaction mode ile uyumluluk
  ...(pooler ? { statement_timeout: 10_000 } : {}),
  application_name: `berkbey-${isSupabase ? "supabase" : "postgres"}`,
};

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool = globalForDb.__arenaNextJsPostgresqlPool ?? new Pool(poolConfig);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

export type DbInfo = {
  provider: "supabase" | "postgres";
  host: string;
  database: string;
  port: string;
  ssl: boolean;
  pooler: boolean;
  via: string;
};

export function getDbInfo(): DbInfo {
  return {
    provider: isSupabase ? "supabase" : "postgres",
    host,
    database: parsed.pathname.replace(/^\//, "") || "-",
    port: parsed.port || "5432",
    ssl: useSsl,
    pooler,
    via: process.env.SUPABASE_DB_URL
      ? "SUPABASE_DB_URL"
      : process.env.POSTGRES_URL
        ? "POSTGRES_URL"
        : "DATABASE_URL",
  };
}

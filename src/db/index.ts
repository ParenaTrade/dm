import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

/**
 * Bağlantı çözümleme (Vercel + Supabase uyumlu):
 *  1) SUPABASE_DB_URL          -> Supabase "Connection string" (pooler önerilir)
 *  2) POSTGRES_URL             -> Vercel/Supabase entegrasyon değişkeni
 *  3) DATABASE_URL             -> yerel geliştirme / genel yedek
 */
const RAW_URL = (
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  ""
).trim();

if (!RAW_URL) {
  throw new Error(
    "Veritabanı bağlantısı bulunamadı. SUPABASE_DB_URL (veya DATABASE_URL) ortam değişkenini tanımla.",
  );
}

const parsed = new URL(RAW_URL);

/**
 * KRİTİK DÜZELTME (SELF_SIGNED_CERT_IN_CHAIN):
 * `pg`, connection string içindeki sslmode/sslcert/sslrootcert gibi parametreleri
 * `ssl` seçeneğinin ÜZERİNE yazar (Object.assign({}, config, parse(url))).
 * Vercel/Supabase'in verdiği POSTGRES_URL "?sslmode=require&supa=base-pooler.x"
 * içerdiği için pg 8.20'de bu 'verify-full' olarak yorumlanıyor ve Supabase
 * pooler zinciri doğrulanamıyordu. Bu yüzden SSL ile ilgili tüm parametreleri
 * URL'den temizleyip TLS ayarını yalnızca aşağıdaki `ssl` nesnesinden veriyoruz.
 */
const SSL_QUERY_KEYS = [
  "sslmode",
  "ssl",
  "sslcert",
  "sslkey",
  "sslrootcert",
  "sslcrl",
  "sslnegotiation",
  "uselibpqcompat",
  "supa",
];
const hadPgbouncerFlag = /pgbouncer=true/i.test(parsed.search || "");
for (const key of SSL_QUERY_KEYS) parsed.searchParams.delete(key);
parsed.searchParams.delete("pgbouncer");
const CONNECTION_STRING = parsed.toString();
const host = parsed.hostname;
const isSupabase =
  /supabase\.(co|com|net)$/i.test(host) || /pooler\.supabase/i.test(host) || Boolean(process.env.SUPABASE_DB_URL);
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";

/**
 * Supabase'de TLS zorunludur. Pooler (port 6543 / transaction mode) serverless
 * (Vercel) için önerilir; 5432 ise oturum modudur.
 */
const useSsl = !isLocal;
// Supabase pooler zinciri Node'un güvenilen CA listesinde olmadığından doğrulama kapalı.
const sslConfig = useSsl ? { rejectUnauthorized: false } : undefined;

const pooler = parsed.port === "6543" || hadPgbouncerFlag;

const poolConfig: PoolConfig = {
  connectionString: CONNECTION_STRING,
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

// Boşta kalan bağlantıdaki hata süreci düşürmesin
pool.on("error", (error) => {
  console.error("[pg pool] beklenmeyen hata:", error.message);
});

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

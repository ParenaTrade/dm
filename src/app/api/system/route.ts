import { sql } from "drizzle-orm";
import { db, getDbInfo } from "@/db";
import { tryEnsureDatabase } from "@/lib/bootstrap";
import { checkSupabaseRest, getSupabaseStatus } from "@/lib/supabase-server";
import { getCurrentUser, isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLES = [
  "users",
  "sessions",
  "streams",
  "stream_participants",
  "rtc_signals",
  "chat_messages",
  "moderators",
  "schedule_items",
  "giveaways",
  "activity_log",
] as const;

export async function GET() {
  const me = await getCurrentUser();
  const staff = isStaff(me);
  const info = getDbInfo();
  const boot = await tryEnsureDatabase();

  const rows: { table: string; rows: number }[] = [];
  let dbOk = true;
  let dbError: string | undefined;

  try {
    for (const table of TABLES) {
      const result = await db.execute<{ c: number }>(
        sql`select count(*)::int as c from ${sql.identifier(table)}`,
      );
      const list = (result as unknown as { rows?: { c: number }[] }).rows ?? [];
      rows.push({ table, rows: Number(list[0]?.c ?? 0) });
    }
  } catch (error) {
    dbOk = false;
    dbError = error instanceof Error ? error.message : String(error);
  }

  if (!staff) {
    // Yetkisiz kullanıcılar yalnızca Aktif / Pasif bilgisini görür.
    return Response.json({ ok: true, active: dbOk && boot.ok });
  }

  const supabase = getSupabaseStatus();
  const rest = supabase.url ? await checkSupabaseRest() : { ok: false, error: "URL tanımlı değil" };

  return Response.json({
    ok: dbOk,
    active: dbOk && boot.ok,
    db: { ...info, connected: dbOk, error: dbError, bootstrapped: boot.ok, bootError: boot.error },
    tables: rows,
    realtime: {
      configured: supabase.realtimeReady,
      url: supabase.url,
      anonKey: supabase.anonKey,
      rest: rest.ok,
      restError: rest.error,
    },
    deployment: process.env.VERCEL ? "vercel" : "self-hosted",
    region: process.env.VERCEL_REGION ?? "local",
  });
}

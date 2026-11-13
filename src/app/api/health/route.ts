import { sql } from "drizzle-orm";
import { db, getDbInfo } from "@/db";
import { getSupabaseStatus } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const info = getDbInfo();
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      db: { ...info, connected: true },
      supabase: getSupabaseStatus(),
      runtime: "nodejs",
      region: process.env.VERCEL_REGION ?? "local",
      deployment: process.env.VERCEL ? "vercel" : "self-hosted",
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        db: { ...info, connected: false },
        error: error instanceof Error ? error.message : "db error",
      },
      { status: 500 },
    );
  }
}

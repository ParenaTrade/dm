import { sql } from "drizzle-orm";
import { db, getDbInfo } from "@/db";
import { getSupabaseStatus } from "@/lib/supabase-server";
import { getCurrentUser, isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const info = getDbInfo();
  const staff = isStaff(await getCurrentUser());
  try {
    await db.execute(sql`select 1`);
    if (!staff) return Response.json({ ok: true, active: true });
    return Response.json({
      ok: true,
      db: { ...info, connected: true },
      supabase: getSupabaseStatus(),
      runtime: "nodejs",
      region: process.env.VERCEL_REGION ?? "local",
      deployment: process.env.VERCEL ? "vercel" : "self-hosted",
    });
  } catch (error) {
    if (!staff) return Response.json({ ok: false, active: false }, { status: 500 });
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

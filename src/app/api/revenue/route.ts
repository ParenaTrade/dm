import { sql } from "drizzle-orm";
import { db } from "@/db";
import { sponsors } from "@/db/schema";
import { ensureSeed } from "@/lib/seed";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin: sponsor bazında tıklama, dönüşüm ve komisyon özeti. */
export async function GET() {
  await ensureSeed();
  const me = await getCurrentUser();
  if (!me || me.role !== "host") return Response.json({ ok: false, error: "Yetki yok" }, { status: 403 });

  const clicks = await db.execute(sql`
    SELECT sponsor_id,
           count(*)::int AS total,
           count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week,
           count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS today
    FROM affiliate_clicks GROUP BY sponsor_id`);
  const conv = await db.execute(sql`
    SELECT sponsor_id,
           count(*) FILTER (WHERE event IN ('signup','reg','registration'))::int AS signups,
           count(*) FILTER (WHERE event IN ('ftd','deposit','first_deposit'))::int AS deposits,
           coalesce(sum(amount),0)::float AS amount,
           coalesce(sum(commission),0)::float AS commission
    FROM affiliate_conversions GROUP BY sponsor_id`);
  const rows = await db.select().from(sponsors);

  type ClickRow = { sponsor_id: number | null; total: number; week: number; today: number };
  type ConvRow = { sponsor_id: number | null; signups: number; deposits: number; amount: number; commission: number };
  const clickRows = (clicks as unknown as { rows?: ClickRow[] }).rows ?? (clicks as unknown as ClickRow[]);
  const convRows = (conv as unknown as { rows?: ConvRow[] }).rows ?? (conv as unknown as ConvRow[]);

  const list = rows.map((s) => {
    const c = clickRows.find((x) => x.sponsor_id === s.id);
    const v = convRows.find((x) => x.sponsor_id === s.id);
    return {
      id: s.id,
      name: s.name,
      clicksTotal: c?.total ?? 0,
      clicksWeek: c?.week ?? 0,
      clicksToday: c?.today ?? 0,
      signups: v?.signups ?? 0,
      deposits: v?.deposits ?? 0,
      amount: v?.amount ?? 0,
      commission: v?.commission ?? 0,
    };
  });
  const totals = list.reduce(
    (a, r) => ({
      clicks: a.clicks + r.clicksTotal,
      signups: a.signups + r.signups,
      deposits: a.deposits + r.deposits,
      commission: a.commission + r.commission,
    }),
    { clicks: 0, signups: 0, deposits: 0, commission: 0 },
  );
  return Response.json({ ok: true, totals, sponsors: list, postbackReady: Boolean(process.env.AFFILIATE_POSTBACK_SECRET) });
}

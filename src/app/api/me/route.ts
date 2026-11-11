import { cookies } from "next/headers";
import { db } from "@/db";
import { coinLedger, notifications, profiles } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { route } from "@/lib/api";
import { getUser, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const u = await getUser();
  if (!u) return { user: null };
  const [notes, ledger] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.id)).limit(10),
    db.select().from(coinLedger).where(eq(coinLedger.userId, u.id)).orderBy(desc(coinLedger.id)).limit(6),
  ]);
  return {
    user: { id: u.id, username: u.username, level: u.level, xp: u.xp, coinBalance: u.coinBalance, role: u.role },
    notifications: notes, ledger,
  };
});

/** action: mark_read | confirm_age */
export const POST = route(async (req) => {
  const { action } = (await req.json()) as { action: string };
  if (action === "confirm_age") {
    (await cookies()).set("age_ok", "1", { path: "/", maxAge: 365 * 864e5 / 1000, sameSite: "lax" });
    const u = await getUser();
    if (u && !u.ageConfirmedAt) await db.update(profiles).set({ ageConfirmedAt: new Date() }).where(eq(profiles.id, u.id));
    return { ok: true };
  }
  const u = await requireUser();
  if (action === "mark_read") await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.userId, u.id), eq(notifications.isRead, false)));
  return { ok: true };
});

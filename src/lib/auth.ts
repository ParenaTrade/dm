import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessStaff } from "@/db/schema";

export type Actor = { email: string; name: string; role: string; businessId: string };

/**
 * Yetki kontrolü sunucuda yapılır. Rol, istemciden gelen değerden değil
 * business_staff tablosundan okunur.
 */
export async function resolveActor(businessId: string, email: string): Promise<Actor | null> {
  const rows = await db
    .select()
    .from(businessStaff)
    .where(eq(businessStaff.businessId, businessId));
  const row = rows.find((r) => r.email.toLowerCase() === (email ?? "").toLowerCase() && r.active);
  if (!row) return null;
  return { email: row.email, name: row.name, role: row.role, businessId };
}

export function can(role: string, action: string): boolean {
  const R: Record<string, string[]> = {
    CASHIER: ["kasa.read", "kasa.sell", "transaction.read"],
    MANAGER: [
      "kasa.read",
      "kasa.sell",
      "transaction.read",
      "campaign.write",
      "content.approve",
      "ai.generate",
      "staff.read",
      "report.read",
      "transaction.reverse",
    ],
    OWNER: [
      "kasa.read",
      "kasa.sell",
      "transaction.read",
      "campaign.write",
      "content.approve",
      "ai.generate",
      "staff.read",
      "report.read",
      "transaction.reverse",
      "contract.read",
      "settings.write",
    ],
  };
  return (R[role] ?? []).includes(action);
}

export function deny(role: string, action: string) {
  return Response.json(
    { ok: false, error: `${role} rolü "${action}" işlemi için yetkili değil.` },
    { status: 403 }
  );
}

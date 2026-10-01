import { eq } from "drizzle-orm";
import { db } from "@/db";
import { packages, fraudReviews, transactions, users } from "@/db/schema";
import { logAudit } from "@/lib/finance";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const action = String(body.action ?? "");

  if (action === "package_price") {
    const code = String(body.code ?? "");
    const price = Math.max(0, Math.round(Number(body.priceMonthlyCents ?? 0)));
    const [row] = await db
      .update(packages)
      .set({ priceMonthlyCents: price })
      .where(eq(packages.code, code))
      .returning();
    await logAudit("admin@dampingvar.com", "ADMIN", "PACKAGE_PRICE_UPDATED", "packages", row?.id ?? null, {
      code,
      price,
    });
    return Response.json({ ok: true, package: row });
  }

  if (action === "fraud_resolve") {
    const id = String(body.id ?? "");
    const status = body.status === "CLEARED" ? "CLEARED" : "BLOCKED";
    const [row] = await db.update(fraudReviews).set({ status }).where(eq(fraudReviews.id, id)).returning();
    if (status === "BLOCKED" && row?.transactionId) {
      await db.update(transactions).set({ status: "FRAUD_REVIEW" }).where(eq(transactions.id, row.transactionId));
    }
    await logAudit("admin@dampingvar.com", "ADMIN", `FRAUD_${status}`, "fraud_reviews", id, {});
    return Response.json({ ok: true, fraud: row });
  }

  if (action === "set_user_balance") {
    // Kural: bakiye düzeltmesi ledger olmadan yapılamaz
    return Response.json(
      { ok: false, error: "Bakiye düzeltmesi ledger kaydı olmadan yapılamaz." },
      { status: 400 }
    );
  }

  return Response.json({ ok: false, error: "Bilinmeyen admin işlemi." }, { status: 400 });
}

export async function GET() {
  const usersList = await db.select().from(users).limit(5);
  return Response.json({ ok: true, users: usersList.length });
}

import { ensureSeed } from "@/lib/seed";
import { findUserByEmail } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** E-posta ile kayıtlı hesap var mı? (kayıt formunu açıp açmamaya karar vermek için) */
export async function GET(request: Request) {
  const email = (new URL(request.url).searchParams.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, error: "Geçersiz e-posta" }, { status: 400 });
  }
  try {
    await ensureSeed();
    return Response.json({ ok: true, exists: Boolean(await findUserByEmail(email)) });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}

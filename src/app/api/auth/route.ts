import { createClient } from "@supabase/supabase-js";
import { ensureSeed } from "@/lib/seed";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase-server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { participants, users } from "@/db/schema";
import {
  createSession,
  destroySession,
  getCurrentUser,
  isNicknameTaken,
  isReservedNickname,
  normalizeNickname,
  toCurrentUser,
  upsertAuthUser,
  validateNickname,
} from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Supabase Auth (e-posta + şifre) erişim jetonunu doğrular ve oturum çerezi açar. */
export async function POST(request: Request) {
  await ensureSeed();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Response.json(
      { ok: false, error: "Giriş sistemi yapılandırılmamış (Supabase URL / anon key eksik)." },
      { status: 503 },
    );
  }

  const payload: { accessToken?: string } = await request.json().catch(() => ({}));
  const token = (payload.accessToken ?? "").trim();
  if (!token) return Response.json({ ok: false, error: "Oturum bulunamadı." }, { status: 400 });

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  const gUser = data?.user;
  if (error || !gUser?.email) {
    return Response.json({ ok: false, error: "Oturum doğrulanamadı." }, { status: 401 });
  }
  if (!gUser.email_confirmed_at) {
    return Response.json(
      { ok: false, error: "E-posta adresin henüz onaylanmamış. Gelen kutundaki bağlantıya tıkla." },
      { status: 403 },
    );
  }

  const meta = (gUser.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(meta.full_name ?? meta.name ?? "");  // kayıt formundaki Ad Soyad
  const avatar = String(meta.avatar_url ?? meta.picture ?? "") || null;

  const nickname = String(meta.nickname ?? "");
  const user = await upsertAuthUser({ email: gUser.email, name, nickname, avatarUrl: avatar });
  if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
    return Response.json({ ok: false, error: "Hesabınız yayından uzaklaştırılmış." }, { status: 403 });
  }

  await createSession(user.id);
  return Response.json({ ok: true, user: toCurrentUser(user) });
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ ok: true, user, configured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) });
}

/** Rumuz değiştir (herkese görünen ad). */
export async function PATCH(request: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: "Oturum gerekli" }, { status: 401 });
  const payload: { nickname?: string } = await request.json().catch(() => ({}));
  const nickname = normalizeNickname(payload.nickname ?? "");
  const invalid = validateNickname(nickname);
  if (invalid) return Response.json({ ok: false, error: invalid }, { status: 400 });
  if (me.role === "viewer" && isReservedNickname(nickname)) {
    return Response.json({ ok: false, error: "Bu rumuz ayrılmış, başka bir rumuz seç." }, { status: 400 });
  }
  if (await isNicknameTaken(nickname, me.id)) {
    return Response.json({ ok: false, error: "Bu rumuz kullanılıyor." }, { status: 409 });
  }
  const rows = await db
    .update(users)
    .set({ nickname, nicknameLower: nickname.toLocaleLowerCase("tr") })
    .where(eq(users.id, me.id))
    .returning();
  await db.update(participants).set({ nickname }).where(eq(participants.userId, me.id));
  return Response.json({ ok: true, user: toCurrentUser(rows[0]) });
}

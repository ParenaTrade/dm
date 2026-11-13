import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { moderators, sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "bb_session";

export type CurrentUser = {
  id: number;
  email: string;
  avatarUrl: string | null;
  nickname: string;
  role: string;
  accent: string;
  isVip: boolean;
  mutedUntil: string | null;
  bannedUntil: string | null;
};

export type DbUser = typeof users.$inferSelect;

export const ACCENTS = [
  "#a855f7",
  "#f5c542",
  "#ff2fb9",
  "#22d3ee",
  "#4ade80",
  "#fb923c",
  "#60a5fa",
  "#f87171",
];

export function normalizeNickname(raw: string) {
  return raw.trim().replace(/\s+/g, " ").slice(0, 20);
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Google hesabıyla gelen kullanıcıyı oluşturur/günceller; rolü e-postadan türetir. */
export async function upsertGoogleUser(profile: {
  email: string;
  name: string;
  avatarUrl: string | null;
}): Promise<DbUser> {
  const email = profile.email.trim().toLowerCase();
  const fallback = email.split("@")[0];
  const nickname = normalizeNickname(profile.name) || normalizeNickname(fallback) || "Konuk";
  const lower = nickname.toLocaleLowerCase("tr");
  const accent = ACCENTS[Math.abs(hashCode(email)) % ACCENTS.length];

  let role = "viewer";
  if (adminEmails().includes(email)) {
    role = "host";
  } else {
    const mod = await db
      .select({ id: moderators.id })
      .from(moderators)
      .where(eq(moderators.email, email))
      .limit(1);
    if (mod[0]) role = "moderator";
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    const updated = await db
      .update(users)
      .set({
        nickname,
        nicknameLower: lower,
        avatarUrl: profile.avatarUrl,
        role,
        isVip: role === "host" ? true : existing[0].isVip,
        lastSeenAt: new Date(),
      })
      .where(eq(users.id, existing[0].id))
      .returning();
    return updated[0];
  }

  const inserted = await db
    .insert(users)
    .values({
      nickname,
      nicknameLower: lower,
      email,
      avatarUrl: profile.avatarUrl,
      role,
      accent,
      isVip: role === "host",
    })
    .returning();
  return inserted[0];
}

function hashCode(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export async function createSession(userId: number) {
  const token = randomUUID();
  await db.insert(sessions).values({ token, userId });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const rows = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.token, token))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return toCurrentUser(row.user);
  } catch {
    return null;
  }
}

export function toCurrentUser(user: DbUser): CurrentUser {
  return {
    id: user.id,
    email: user.email ?? "",
    avatarUrl: user.avatarUrl ?? null,
    nickname: user.nickname,
    role: user.role,
    accent: user.accent,
    isVip: user.isVip,
    mutedUntil: user.mutedUntil ? user.mutedUntil.toISOString() : null,
    bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
  };
}

export async function findUserByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return rows[0] ?? null;
}

export async function isUserBanned(user: DbUser) {
  return Boolean(user.bannedUntil && user.bannedUntil.getTime() > Date.now());
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  jar.delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("NO_SESSION");
  return user;
}

export function isStaff(user: CurrentUser | null) {
  return user?.role === "host" || user?.role === "moderator";
}

export async function activeBanCheck(userId: number) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), gt(users.bannedUntil, new Date())))
    .limit(1);
  return rows.length > 0;
}

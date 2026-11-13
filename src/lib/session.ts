import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "bb_session";

export type CurrentUser = {
  id: number;
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

export async function upsertUser(nickname: string): Promise<DbUser> {
  const clean = normalizeNickname(nickname);
  const lower = clean.toLocaleLowerCase("tr");
  const accent = ACCENTS[Math.abs(hashCode(lower)) % ACCENTS.length];

  const existing = await db.select().from(users).where(eq(users.nicknameLower, lower)).limit(1);
  if (existing[0]) {
    const banned = existing[0].bannedUntil && existing[0].bannedUntil.getTime() > Date.now();
    await db
      .update(users)
      .set({ lastSeenAt: new Date(), accent: banned ? existing[0].accent : accent })
      .where(eq(users.id, existing[0].id));
    return existing[0];
  }

  const inserted = await db
    .insert(users)
    .values({ nickname: clean, nicknameLower: lower, accent })
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
    nickname: user.nickname,
    role: user.role,
    accent: user.accent,
    isVip: user.isVip,
    mutedUntil: user.mutedUntil ? user.mutedUntil.toISOString() : null,
    bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
  };
}

export async function findUserByNickname(nickname: string) {
  const lower = normalizeNickname(nickname).toLocaleLowerCase("tr");
  const rows = await db.select().from(users).where(eq(users.nicknameLower, lower)).limit(1);
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

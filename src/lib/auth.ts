import { cookies, headers } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { profiles, sessions, auditLogs } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";

export type Profile = typeof profiles.$inferSelect;
export const SESSION_COOKIE = "sid";

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 864e5);
  await db.insert(sessions).values({ token, userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https"),
    path: "/", expires: expiresAt,
  });
}

export async function destroySession() {
  const c = await cookies();
  const t = c.get(SESSION_COOKIE)?.value;
  if (t) await db.delete(sessions).where(eq(sessions.token, t));
  c.delete(SESSION_COOKIE);
}

export async function getUser(): Promise<Profile | null> {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!t) return null;
  const rows = await db
    .select({ p: profiles })
    .from(sessions)
    .innerJoin(profiles, eq(profiles.id, sessions.userId))
    .where(and(eq(sessions.token, t), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.p ?? null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireUser() {
  const u = await getUser();
  if (!u) throw new HttpError(401, "Bu işlem için giriş yapmalısın.");
  if (u.bannedUntil && u.bannedUntil > new Date()) throw new HttpError(403, "Hesabın geçici olarak yasaklandı.");
  return u;
}

export const isStaff = (u: Profile | null) => !!u && (u.role === "admin" || u.role === "mod");
export const isAdmin = (u: Profile | null) => u?.role === "admin";

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") throw new HttpError(403, "Yalnızca adminler erişebilir.");
  return u;
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

export async function audit(actorId: string | null, action: string, oldValue?: unknown, newValue?: unknown) {
  await db.insert(auditLogs).values({
    actorId, action, oldValue: oldValue ?? null, newValue: newValue ?? null, ip: await clientIp(),
  });
}

export const levelForXp = (xp: number) => Math.floor(xp / 100) + 1;

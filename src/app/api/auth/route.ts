import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { route, rateLimit } from "@/lib/api";
import { HttpError, clientIp, createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), username: z.string().min(3).max(24), password: z.string().min(6).max(100) }),
  z.object({
    action: z.literal("register"),
    username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/, "Kullanıcı adı 3-20 karakter, harf/rakam/_"),
    password: z.string().min(6, "Şifre en az 6 karakter").max(100),
    birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
    ageConfirm: z.literal(true, { message: "18 yaşından büyük olduğunu onaylamalısın" }),
  }),
  z.object({ action: z.literal("logout") }),
]);

export const POST = route(async (req) => {
  const body = schema.parse(await req.json());
  rateLimit(`auth:${await clientIp()}`, 10, 60_000);
  if (body.action === "logout") { await destroySession(); return { ok: true }; }
  const username = body.username.toLowerCase();
  const existing = (await db.select().from(profiles).where(eq(profiles.username, username)).limit(1))[0];
  if (body.action === "login") {
    if (!existing || !verifyPassword(body.password, existing.passwordHash)) throw new HttpError(401, "Kullanıcı adı veya şifre hatalı.");
    await createSession(existing.id);
    return { ok: true };
  }
  if (new Date().getFullYear() - body.birthYear < 18) throw new HttpError(403, "Platform yalnızca 18 yaş ve üzeri kullanıcılara açıktır.");
  if (existing) throw new HttpError(409, "Bu kullanıcı adı alınmış.");
  const [u] = await db.insert(profiles).values({
    username, passwordHash: hashPassword(body.password), birthYear: body.birthYear, ageConfirmedAt: new Date(),
  }).returning();
  await createSession(u.id);
  return { ok: true };
});

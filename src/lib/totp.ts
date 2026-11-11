/** RFC 6238 TOTP (admin 2FA). Authenticator uygulamalarıyla uyumlu (SHA1, 30 sn, 6 hane). */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./auth";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newTotpSecret() {
  const bytes = randomBytes(20); let bits = "", out = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function b32decode(s: string) {
  let bits = ""; for (const c of s.replace(/=+$/, "").toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, "0");
  const out: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function code(secret: string, counter: number) {
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", b32decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, "0");
}
export function verifyTotp(secret: string, token: string) {
  const c = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some((d) => code(secret, c + d) === token.trim());
}
export const otpauthUrl = (username: string, secret: string) => `otpauth://totp/Cenkbey:${encodeURIComponent(username)}?secret=${secret}&issuer=Cenkbey`;

/** 2FA doğrulanmış oturum çerezi = HMAC(oturum token'ı). */
const sig = (token: string) => createHmac("sha256", process.env.CRON_SECRET || process.env.DATABASE_URL || "dev").update(`2fa:${token}`).digest("hex");
export async function mark2faVerified() {
  const c = await cookies(); const t = c.get(SESSION_COOKIE)?.value; if (!t) return;
  c.set("admin2fa", sig(t), { httpOnly: true, sameSite: "strict", path: "/", maxAge: 12 * 3600 });
}
export async function is2faVerified() {
  const c = await cookies(); const t = c.get(SESSION_COOKIE)?.value; const v = c.get("admin2fa")?.value;
  if (!t || !v) return false;
  const a = Buffer.from(v), b = Buffer.from(sig(t));
  return a.length === b.length && timingSafeEqual(a, b);
}

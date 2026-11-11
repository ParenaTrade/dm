import { db } from "@/db";
import { channels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { HttpError, Profile, isStaff } from "./auth";

export function parseRoom(room: string | null) {
  if (room === "site") return { room, channelId: null as number | null };
  const m = room?.match(/^channel:(\d+)$/);
  if (!m) throw new HttpError(400, "Geçersiz sohbet odası.");
  return { room: room!, channelId: Number(m[1]) };
}

export async function canModerate(u: Profile | null, channelId: number | null) {
  if (!u) return false;
  if (isStaff(u)) return true;
  if (channelId == null) return false;
  const c = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  return c[0]?.ownerId === u.id;
}


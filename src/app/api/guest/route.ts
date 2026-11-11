/** Konuk tarafı: daveti kabul et / reddet / ayrıl. */
import { z } from "zod";
import { db } from "@/db";
import { channels, streamGuests } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { route } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { notify } from "@/lib/platform";

const schema = z.object({ channelId: z.number().int(), action: z.enum(["accept", "decline", "leave"]) });

export const POST = route(async (req) => {
  const u = await requireUser();
  const { channelId, action } = schema.parse(await req.json());
  const g = (await db.select().from(streamGuests).where(and(
    eq(streamGuests.channelId, channelId), eq(streamGuests.userId, u.id), inArray(streamGuests.status, ["invited", "accepted", "live"]),
  )).limit(1))[0];
  if (!g) throw new HttpError(404, "Aktif davet bulunamadı.");
  if (action === "accept") {
    if (g.status !== "invited") return { ok: true };
    await db.update(streamGuests).set({ status: "accepted" }).where(eq(streamGuests.id, g.id));
    const ch = (await db.select().from(channels).where(eq(channels.id, channelId)).limit(1))[0];
    if (ch) await notify(ch.ownerId, "Konuk hazır", `${u.username} daveti kabul etti. Stüdyodan yayına al.`, "guest");
  } else {
    await db.update(streamGuests).set({ status: "removed" }).where(eq(streamGuests.id, g.id));
  }
  return { ok: true };
});

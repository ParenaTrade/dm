import { z } from "zod";
import { db } from "@/db";
import { originalsRounds } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { route, rateLimit } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { flag } from "@/lib/platform";
import { sha256 } from "@/lib/fair";
import { bjAct, bjStart, getSeeds, minesAct, minesStart, playDice, playKeno, publicRound, rotateSeed, verify } from "@/lib/originals";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("verify")) {
    const q = z.object({ game: z.enum(["dice", "keno", "mines", "blackjack"]), serverSeed: z.string().min(8), clientSeed: z.string().min(1), nonce: z.coerce.number().int().min(0), mines: z.coerce.number().int().min(1).max(24).default(3) })
      .parse(Object.fromEntries(url.searchParams));
    return verify(q.game, q.serverSeed, q.clientSeed, q.nonce, q.mines);
  }
  const u = await requireUser();
  const s = await getSeeds(u.id);
  const [active, recent] = await Promise.all([
    db.select().from(originalsRounds).where(and(eq(originalsRounds.userId, u.id), eq(originalsRounds.status, "active"))),
    db.select().from(originalsRounds).where(eq(originalsRounds.userId, u.id)).orderBy(desc(originalsRounds.id)).limit(15),
  ]);
  return {
    seeds: { serverSeedHash: sha256(s.serverSeed), clientSeed: s.clientSeed, nonce: s.nonce, prevServerSeed: s.prevServerSeed, prevServerSeedHash: s.prevServerSeedHash },
    active: active.map(publicRound), recent: recent.map(publicRound),
  };
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("dice"), bet: z.number().int(), target: z.number(), over: z.boolean() }),
  z.object({ action: z.literal("keno"), bet: z.number().int(), picks: z.array(z.number().int()) }),
  z.object({ action: z.literal("mines_start"), bet: z.number().int(), mines: z.number().int() }),
  z.object({ action: z.literal("mines_reveal"), roundId: z.number().int(), tile: z.number().int() }),
  z.object({ action: z.literal("mines_cashout"), roundId: z.number().int() }),
  z.object({ action: z.literal("bj_start"), bet: z.number().int() }),
  z.object({ action: z.literal("bj_hit"), roundId: z.number().int() }),
  z.object({ action: z.literal("bj_stand"), roundId: z.number().int() }),
  z.object({ action: z.literal("rotate_seed"), clientSeed: z.string().max(64).optional() }),
]);

export const POST = route(async (req) => {
  const u = await requireUser();
  if (!(await flag("originals_enabled"))) throw new HttpError(403, "Originals şu an kapalı.");
  if (!u.ageConfirmedAt) throw new HttpError(403, "Önce 18+ yaş onayı vermelisin.");
  rateLimit(`orig:${u.id}`, 40, 10_000);
  const i = schema.parse(await req.json());
  switch (i.action) {
    case "dice": return { round: await playDice(u.id, i.bet, i.target, i.over) };
    case "keno": return { round: await playKeno(u.id, i.bet, i.picks) };
    case "mines_start": return { round: await minesStart(u.id, i.bet, i.mines) };
    case "mines_reveal": return { round: await minesAct(u.id, i.roundId, "reveal", i.tile) };
    case "mines_cashout": return { round: await minesAct(u.id, i.roundId, "cashout") };
    case "bj_start": return { round: await bjStart(u.id, i.bet) };
    case "bj_hit": return { round: await bjAct(u.id, i.roundId, "hit") };
    case "bj_stand": return { round: await bjAct(u.id, i.roundId, "stand") };
    case "rotate_seed": await rotateSeed(u.id, i.clientSeed); return { ok: true };
  }
});

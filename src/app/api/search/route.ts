import { db } from "@/db";
import { channels } from "@/db/schema";
import { ilike, or } from "drizzle-orm";
import { route } from "@/lib/api";
import { visibleSponsors } from "@/lib/platform";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 40);
  if (!q) return { results: [] };
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const ch = await db.select().from(channels).where(or(ilike(channels.slug, like), ilike(channels.title, like))).limit(5);
  const sp = (await visibleSponsors()).filter((s) => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  return {
    results: [
      ...ch.map((c) => ({ label: `${c.slug} – ${c.title}`, href: `/yayin/${c.slug}`, kind: "Kanal" })),
      ...sp.map((s) => ({ label: s.name, href: `/sponsors#${s.slug}`, kind: "Sponsor" })),
    ],
  };
});

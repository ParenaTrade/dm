import Link from "next/link";
import { db } from "@/db";
import { profiles, tournamentScores, tournaments } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { Countdown, Page, PageHeader, VirtualNotice } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { prizeFor, tournamentRollover } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function Tournaments({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await tournamentRollover();
  const type = (await searchParams).t === "weekly" ? "weekly" : "daily";
  const u = await getUser();
  const t = (await db.select().from(tournaments).where(and(eq(tournaments.type, type), eq(tournaments.status, "active"))).orderBy(desc(tournaments.id)).limit(1))[0];
  const rows = t ? await db.select({ score: tournamentScores.score, userId: tournamentScores.userId, username: profiles.username, hide: profiles.hideOnLeaderboard })
    .from(tournamentScores).innerJoin(profiles, eq(profiles.id, tournamentScores.userId))
    .where(eq(tournamentScores.tournamentId, t.id)).orderBy(desc(tournamentScores.score)).limit(100) : [];
  const myRank = u ? rows.findIndex((r) => r.userId === u.id) : -1;

  return (
    <Page>
      <PageHeader icon="🏆" title="Turnuvalar" sub="Originals oyunlarındaki çevrimin (toplam bahis) skora dönüşür. İlk sıralar ödül havuzunu paylaşır."
        right={<div className="flex gap-2">{(["daily", "weekly"] as const).map((x) => <Link key={x} href={`/tournaments?t=${x}`} className={`btn ${type === x ? "btn-red" : "btn-ghost"}`}>{x === "daily" ? "Günlük" : "Haftalık"}</Link>)}</div>} />
      {t && (
        <div className="grid md:grid-cols-3 gap-4 mb-5">
          <div className="card p-5"><div className="text-xs text-muted">Ödül havuzu</div><div className="text-3xl font-black text-accent2">🪙 {t.prizePool.toLocaleString("tr-TR")}</div></div>
          <div className="card p-5"><div className="text-xs text-muted">Kalan süre</div><div className="text-3xl font-black"><Countdown to={t.endsAt} /></div></div>
          <div className="card p-5"><div className="text-xs text-muted">Senin sıran</div><div className="text-3xl font-black">{myRank >= 0 ? `#${myRank + 1}` : "—"}</div><div className="text-xs text-muted">İlk {t.winnersCount} ödül alır</div></div>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-muted text-xs bg-white/5"><tr><th className="p-3 text-left">#</th><th className="text-left">Kullanıcı</th><th className="text-right">Çevrim</th><th className="text-right p-3">Ödül</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted">Henüz skor yok. <Link href="/originals" className="text-accent2">Originals'ta oyna</Link></td></tr>}
            {rows.map((r, i) => (
              <tr key={r.userId} className={`border-t border-line ${r.userId === u?.id ? "bg-accent/10" : ""}`}>
                <td className="p-3 font-bold">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                <td>{r.hide && r.userId !== u?.id ? <span className="text-muted">🕶 Gizli kullanıcı</span> : r.username}</td>
                <td className="text-right tabular-nums">{r.score.toLocaleString("tr-TR")}</td>
                <td className="text-right p-3 tabular-nums text-green-400">{t && i < t.winnersCount ? prizeFor(t.prizePool, t.winnersCount, i).toLocaleString("tr-TR") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3"><VirtualNotice /> <p className="text-[11px] text-muted">Sıralamada gizli görünmek için Profil sayfasından “Gizli kullanıcı” seçeneğini aç.</p></div>
    </Page>
  );
}

import { db } from "@/db";
import { quests, userQuests } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { Countdown, Flash, Page, PageHeader, VirtualNotice } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { nextDayReset, today } from "@/lib/platform";
import { completeSocialQuest } from "../actions";

export const dynamic = "force-dynamic";

export default async function Quests({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const u = await getUser();
  const qs = await db.select().from(quests).where(eq(quests.isActive, true));
  const prog = u ? await db.select().from(userQuests).where(and(eq(userQuests.userId, u.id), inArray(userQuests.period, [today(), "once"]))) : [];
  const get = (id: number) => prog.find((p) => p.questId === id);

  const Section = ({ kind, title }: { kind: string; title: string }) => (
    <div>
      <h2 className="font-bold mb-3">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {qs.filter((q) => q.kind === kind).map((q) => {
          const p = get(q.id); const done = !!p?.completedAt; const pct = Math.min(100, ((p?.progress ?? 0) / q.rules.target) * 100);
          return (
            <div key={q.id} className={`card p-4 ${done ? "border-green-600/50" : ""}`}>
              <div className="flex justify-between gap-2"><span className="font-semibold">{q.title}</span><span className="text-accent2 font-bold whitespace-nowrap">🪙 {q.rewardCoin}</span></div>
              <div className="h-2 bg-line rounded mt-3"><div className={`h-full rounded ${done ? "bg-green-500" : "bg-accent"}`} style={{ width: `${pct}%` }} /></div>
              <div className="flex justify-between items-center mt-2 text-xs text-muted">
                <span>{p?.progress ?? 0}/{q.rules.target}</span>
                {done ? <span className="text-green-400">✓ Tamamlandı{p?.claimedAt ? "" : " – Ödüller'de"}</span>
                  : kind === "social" && u ? (
                    <form action={completeSocialQuest} className="flex gap-2 items-center">
                      <a href={q.rules.url} target="_blank" rel="noopener noreferrer" className="underline">Aç</a>
                      <input type="hidden" name="id" value={q.id} /><button className="btn btn-ghost py-1 px-2 text-xs">Doğrula</button>
                    </form>) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Page>
      <PageHeader icon="🎯" title="Görevler" sub="Görevleri tamamla, ödüllerini Ödüller sayfasından topla."
        right={<div className="card px-4 py-2 text-sm">Günlük sıfırlanma: <Countdown to={nextDayReset()} className="font-bold" /></div>} />
      <Flash msg={msg} />
      {!u && <div className="card p-4 mb-4 text-sm text-muted">İlerlemeni görmek için giriş yap.</div>}
      <div className="space-y-8"><Section kind="daily" title="📅 Günlük görevler" /><Section kind="social" title="🌐 Sosyal görevler" /></div>
      <div className="mt-6"><VirtualNotice /></div>
    </Page>
  );
}

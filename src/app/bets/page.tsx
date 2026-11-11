import Link from "next/link";
import { db } from "@/db";
import { predictionEntries, predictions } from "@/db/schema";
import { desc, eq, inArray, ne } from "drizzle-orm";
import { Countdown, Page, PageHeader, VirtualNotice } from "@/components/ui";
import { getUser } from "@/lib/auth";
import PredictionForm from "@/components/PredictionForm";

export const dynamic = "force-dynamic";

export default async function Bets({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab ?? "live";
  const u = await getUser();
  let list: (typeof predictions.$inferSelect)[] = [];
  if (tab === "live") list = await db.select().from(predictions).where(eq(predictions.status, "open")).orderBy(desc(predictions.id));
  else if (tab === "settled") list = await db.select().from(predictions).where(ne(predictions.status, "open")).orderBy(desc(predictions.id)).limit(30);
  else if (u) {
    const ids = (await db.selectDistinct({ id: predictionEntries.predictionId }).from(predictionEntries).where(eq(predictionEntries.userId, u.id))).map((x) => x.id);
    list = ids.length ? await db.select().from(predictions).where(inArray(predictions.id, ids)).orderBy(desc(predictions.id)) : [];
  }
  const entries = list.length ? await db.select().from(predictionEntries).where(inArray(predictionEntries.predictionId, list.map((p) => p.id))) : [];

  return (
    <Page>
      <PageHeader icon="📊" title="Tahmin Sistemi" sub="Yayındaki sorulara sanal coin ile tahmin yap. Havuz kazananlar arasında orantılı (parimutuel) paylaşılır."
        right={<div className="flex gap-2">{[["live", "Canlı"], ["settled", "Sonuçlanan"], ["mine", "Tahminlerim"]].map(([k, l]) => <Link key={k} href={`/bets?tab=${k}`} className={`btn ${tab === k ? "btn-red" : "btn-ghost"}`}>{l}</Link>)}</div>} />
      <div className="grid md:grid-cols-2 gap-4">
        {list.length === 0 && <div className="card p-8 text-center text-muted md:col-span-2">{tab === "mine" && !u ? "Giriş yapmalısın." : "Burada henüz tahmin yok."}</div>}
        {list.map((p) => {
          const es = entries.filter((e) => e.predictionId === p.id);
          const participants = new Set(es.map((e) => e.userId)).size;
          const mine = u ? es.filter((e) => e.userId === u.id) : [];
          const open = p.status === "open" && p.closesAt > new Date();
          return (
            <div key={p.id} className="card p-5">
              <div className="flex justify-between gap-2 text-xs text-muted">
                <span className="badge bg-white/10 uppercase">{p.type}</span>
                <span>{p.status === "open" ? (open ? <>Kapanışa <Countdown to={p.closesAt} /></> : "Giriş kapandı – sonuç bekleniyor") : p.status === "settled" ? `Sonuç: ${p.result}` : "İptal – iade edildi"}</span>
              </div>
              <h3 className="font-bold text-lg mt-2">{p.title}</h3>
              <div className="text-sm text-muted">Havuz: <b className="text-white">🪙 {p.totalPool.toLocaleString("tr-TR")}</b> · {participants} katılımcı</div>
              <div className="mt-3 space-y-2">
                {p.options.map((o) => {
                  const stake = es.filter((e) => e.option === o).reduce((a, e) => a + e.amount, 0);
                  const pct = p.totalPool ? Math.round((stake / p.totalPool) * 100) : 0;
                  const mult = stake ? (p.totalPool / stake).toFixed(2) : "—";
                  return (
                    <div key={o} className={`relative rounded-lg overflow-hidden bg-white/5 ${p.result === o ? "ring-2 ring-green-500" : ""}`}>
                      <div className="absolute inset-y-0 left-0 bg-accent/25" style={{ width: `${pct}%` }} />
                      <div className="relative flex justify-between px-3 py-2 text-sm"><span>{o}</span><span className="text-muted">{pct}% · Ödemede coin başı {mult}×</span></div>
                    </div>
                  );
                })}
              </div>
              {mine.length > 0 && <div className="mt-3 text-xs text-muted">Senin tahminin: {mine.map((e) => `${e.option} (${e.amount}${e.payout != null ? ` → ${e.payout}` : ""})`).join(", ")}</div>}
              {open && <PredictionForm id={p.id} options={p.options} />}
            </div>
          );
        })}
      </div>
      <div className="mt-4"><VirtualNotice /></div>
    </Page>
  );
}

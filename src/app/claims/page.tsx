import Link from "next/link";
import { db } from "@/db";
import { claims, coinLedger } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Flash, Page, PageHeader, VirtualNotice } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { claimReward } from "../actions";

export const dynamic = "force-dynamic";

export default async function Claims({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const u = await getUser();
  if (!u) return <Page><PageHeader icon="💰" title="Ödüller" /><div className="card p-8 text-center text-muted">Ödüllerini görmek için giriş yap.</div></Page>;
  const [all, ledger] = await Promise.all([
    db.select().from(claims).where(eq(claims.userId, u.id)).orderBy(desc(claims.id)).limit(100),
    db.select().from(coinLedger).where(eq(coinLedger.userId, u.id)).orderBy(desc(coinLedger.id)).limit(30),
  ]);
  const pending = all.filter((c) => c.status === "pending"), claimed = all.filter((c) => c.status === "claimed");
  const total = pending.reduce((a, c) => a + c.amount, 0);
  return (
    <Page>
      <PageHeader icon="💰" title="Ödül Kutusu" sub="Görev, turnuva ve etkinlik ödüllerin burada birikir."
        right={pending.length > 0 && <form action={claimReward}><button className="btn btn-red">Hepsini topla (🪙 {total})</button></form>} />
      <Flash msg={msg} />
      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <h2 className="font-bold mb-3">Alınabilir ({pending.length})</h2>
          <div className="space-y-2">
            {pending.length === 0 && <div className="card p-6 text-center text-muted text-sm">Bekleyen ödül yok. <Link href="/quests" className="text-accent2">Görevlere göz at</Link></div>}
            {pending.map((c) => (
              <form key={c.id} action={claimReward} className="card p-3 flex items-center gap-3">
                <span className="text-2xl">🎁</span><div className="flex-1"><div className="font-semibold text-sm">{c.source}</div><div className="text-xs text-muted">{c.createdAt.toLocaleString("tr-TR")}</div></div>
                <span className="font-bold text-accent2">🪙 {c.amount}</span>
                <input type="hidden" name="id" value={c.id} /><button className="btn btn-red py-1.5">Topla</button>
              </form>
            ))}
          </div>
          <h2 className="font-bold mt-6 mb-3">Toplananlar</h2>
          <div className="card divide-y divide-line">{claimed.slice(0, 20).map((c) => <div key={c.id} className="p-3 flex justify-between text-sm"><span className="text-muted">{c.source}</span><span>🪙 {c.amount}</span></div>)}</div>
        </div>
        <div>
          <h2 className="font-bold mb-3">Coin hareketleri (ledger)</h2>
          <div className="card divide-y divide-line text-sm">
            {ledger.map((l) => <div key={l.id} className="p-3 flex justify-between"><span className="text-muted">{l.reason}<span className="text-[10px] ml-2">{l.createdAt.toLocaleString("tr-TR")}</span></span><span className={l.delta >= 0 ? "text-green-400" : "text-red-400"}>{l.delta > 0 ? "+" : ""}{l.delta} <span className="text-muted text-xs">→ {l.balanceAfter}</span></span></div>)}
          </div>
          <div className="mt-3"><VirtualNotice /></div>
        </div>
      </div>
    </Page>
  );
}

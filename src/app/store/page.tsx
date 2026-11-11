import { db } from "@/db";
import { storeItems, storeTickets } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { Countdown, Flash, Page, PageHeader, VirtualNotice } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { flag } from "@/lib/platform";
import { buyTicket } from "../actions";

export const dynamic = "force-dynamic";

export default async function Store({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const [on, u] = await Promise.all([flag("store_enabled"), getUser()]);
  if (!on) return <Page><PageHeader icon="🛍️" title="Store" /><div className="card p-8 text-center text-muted">Store şu an kapalı. (Hukuki inceleme sonrası admin tarafından açılabilir.)</div></Page>;
  const items = await db.select().from(storeItems).where(eq(storeItems.isActive, true));
  const counts = await db.select({ itemId: storeTickets.itemId, n: count() }).from(storeTickets).groupBy(storeTickets.itemId);
  const mine = u ? await db.select({ itemId: storeTickets.itemId, n: count() }).from(storeTickets).where(eq(storeTickets.userId, u.id)).groupBy(storeTickets.itemId) : [];
  return (
    <Page>
      <PageHeader icon="🛍️" title="Store – Çekilişler" sub="Biletler yalnızca aktiviteyle kazanılan sanal coin ile alınır." />
      <Flash msg={msg} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => {
          const sold = counts.find((c) => c.itemId === it.id)?.n ?? 0;
          return (
            <form key={it.id} action={buyTicket} className="card overflow-hidden">
              <div className="h-36 grid place-items-center text-5xl bg-gradient-to-br from-zinc-800 to-zinc-950">🎁</div>
              <div className="p-4 space-y-2">
                <h3 className="font-bold">{it.title}</h3>
                <div className="h-2 bg-line rounded"><div className="h-full bg-accent rounded" style={{ width: `${(sold / it.maxTickets) * 100}%` }} /></div>
                <div className="flex justify-between text-xs text-muted"><span>🎟 {sold}/{it.maxTickets}</span><span>Biletin: {mine.find((m) => m.itemId === it.id)?.n ?? 0}</span></div>
                <div className="text-xs">Bitiş: <Countdown to={it.endsAt} /></div>
                <input type="hidden" name="id" value={it.id} />
                <button className="btn btn-red w-full" disabled={!u}>Bilet al – 🪙 {it.ticketPrice}</button>
              </div>
            </form>
          );
        })}
      </div>
      <div className="mt-4"><VirtualNotice /></div>
    </Page>
  );
}

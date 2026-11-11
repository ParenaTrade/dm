import Link from "next/link";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { Countdown, Page, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
const TYPES: Record<string, string> = { event: "Etkinlik", quest: "Görev", tournament: "Turnuva" };

export default async function Promotions({ searchParams }: { searchParams: Promise<{ type?: string; sort?: string }> }) {
  const sp = await searchParams;
  const list = await db.select().from(promotions).where(sp.type ? eq(promotions.type, sp.type) : undefined)
    .orderBy(sp.sort === "ending" ? asc(promotions.endsAt) : desc(promotions.startsAt));
  const now = new Date();
  const featured = list.find((p) => p.isFeatured && p.endsAt > now);
  const q = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <Page>
      <PageHeader icon="🎁" title="Promosyonlar" />
      {featured && (
        <div className="relative rounded-2xl overflow-hidden border border-line mb-6 p-8" style={{ background: "radial-gradient(circle at 80% 20%, #7f1d1d, #0b0b0f 70%)" }}>
          <span className="badge bg-accent">Öne çıkan</span>
          <h2 className="text-3xl font-black mt-2">{featured.title}</h2>
          <p className="text-white/70 mt-1">{featured.description}</p>
          <div className="mt-4 text-lg">{featured.startsAt > now ? "Başlamasına" : "Bitmesine"}: <Countdown to={featured.startsAt > now ? featured.startsAt : featured.endsAt} className="font-black text-accent2" /></div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <span className="text-muted self-center">Tür:</span>
        {[["", "Tümü"], ...Object.entries(TYPES)].map(([k, l]) => <Link key={l} href={q({ type: k || undefined })} className={`btn py-1 ${(sp.type ?? "") === k ? "btn-red" : "btn-ghost"}`}>{l}</Link>)}
        <span className="text-muted self-center ml-3">Sırala:</span>
        {[["", "Yeni"], ["ending", "Bitmek üzere"]].map(([k, l]) => <Link key={l} href={q({ sort: k || undefined })} className={`btn py-1 ${(sp.sort ?? "") === k ? "btn-red" : "btn-ghost"}`}>{l}</Link>)}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((p) => {
          const status = p.startsAt > now ? "Yakında" : p.endsAt < now ? "Bitti" : "Aktif";
          return (
            <div key={p.id} className="card overflow-hidden">
              <div className="h-28 grid place-items-center text-4xl" style={{ background: "linear-gradient(135deg, #3f0d12, #18181f)" }}>{p.type === "tournament" ? "🏆" : p.type === "quest" ? "🎯" : "🎉"}</div>
              <div className="p-4">
                <div className="flex justify-between text-xs"><span className="badge bg-white/10">{TYPES[p.type] ?? p.type}</span><span className={status === "Aktif" ? "text-green-400" : "text-muted"}>{status}</span></div>
                <h3 className="font-bold mt-2">{p.title}</h3>
                <p className="text-sm text-muted mt-1">{p.description}</p>
                {status !== "Bitti" && <div className="text-xs mt-2">{status === "Yakında" ? "Başlangıç" : "Bitiş"}: <Countdown to={status === "Yakında" ? p.startsAt : p.endsAt} /></div>}
              </div>
            </div>
          );
        })}
      </div>
    </Page>
  );
}

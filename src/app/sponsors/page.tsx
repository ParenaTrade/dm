import { cookies } from "next/headers";
import { Flash, Page, PageHeader } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { country, flag, visibleSponsors } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function SponsorsPage({ searchParams }: { searchParams: Promise<{ unavailable?: string }> }) {
  const sp = await searchParams;
  const [u, c, on, cc] = await Promise.all([getUser(), cookies(), flag("sponsors_enabled"), country()]);
  const ageOk = !!u?.ageConfirmedAt || c.get("age_ok")?.value === "1";
  const list = on && ageOk ? await visibleSponsors(cc) : [];
  const big = list.filter((s) => s.isFeatured), small = list.filter((s) => !s.isFeatured);
  return (
    <Page>
      <PageHeader icon="🤝" title="Sponsorlar" sub="Platformu destekleyen markalar. Bağlantılar affiliate takibi için /go üzerinden yönlendirilir." />
      <div className="card p-4 mb-5 border-yellow-500/40 text-sm text-yellow-200/90">
        ⚠️ <b>Sorumlu oyun:</b> Sponsor içerikleri yalnızca 18 yaş ve üzeri içindir. Hiçbir kampanya kazanç garantisi vermez. Kumar bağımlılık yapabilir; bulunduğun ülkenin yasalarına uy. Yardım için: <a className="underline" href="https://www.yesilay.org.tr" target="_blank" rel="noopener noreferrer">Yeşilay</a>.
      </div>
      {sp.unavailable && <Flash msg="Bu sponsor bölgende kullanılamıyor." />}
      {!ageOk && <div className="card p-8 text-center text-muted">Sponsorları görmek için 18+ yaş onayı gerekli.</div>}
      {ageOk && list.length === 0 && <div className="card p-8 text-center text-muted">Bölgende ({cc}) gösterilebilecek sponsor yok.</div>}
      <div className="grid md:grid-cols-2 gap-4">
        {big.map((s) => <SponsorCard key={s.id} s={s} big />)}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {small.map((s) => <SponsorCard key={s.id} s={s} />)}
      </div>
    </Page>
  );
}

function SponsorCard({ s, big }: { s: Awaited<ReturnType<typeof visibleSponsors>>[number]; big?: boolean }) {
  return (
    <div id={s.slug} className="card overflow-hidden flex flex-col">
      <div className={`${big ? "h-40" : "h-24"} grid place-items-center relative`} style={{ background: `linear-gradient(135deg, ${s.color}, #0b0b0f)` }}>
        <span className={`${big ? "text-4xl" : "text-2xl"} font-black tracking-tight`}>{s.name}</span>
        <span className="absolute top-2 right-2 badge bg-black/50 uppercase">{s.category}</span>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <p className="text-sm text-muted flex-1">{s.description}</p>
        {s.promoCode && <div className="text-xs">Promosyon kodu: <span className="font-mono font-bold bg-white/10 px-2 py-0.5 rounded">{s.promoCode}</span></div>}
        <a href={`/go/${s.slug}`} target="_blank" rel="sponsored noopener noreferrer" className="btn btn-red">{s.ctaText}</a>
        {s.category === "casino" && <span className="text-[10px] text-muted text-center">18+ · Sorumlu oyna · Şartlar geçerlidir</span>}
      </div>
    </div>
  );
}

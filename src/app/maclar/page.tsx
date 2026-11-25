import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { streams } from "@/db/schema";
import { Disclosure } from "@/components/site/Disclosure";
import { MatchList, Empty } from "@/components/site/ContentCards";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ensureSeed } from "@/lib/seed";
import { getSiteImages } from "@/lib/site-images";
import { listItems } from "@/lib/site-content";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Berkbey — Maçlar",
  description: "Yaklaşan ve canlı maç yayınları.",
};

export default async function Page() {
  await ensureSeed();
  const imgs = await getSiteImages();
  const [row] = await db.select().from(streams).orderBy(desc(streams.id)).limit(1);
  const isLive = row?.status === "live";
  const items = await listItems("match");
  return (
    <div className="relative overflow-x-hidden">
      <SiteHeader isLive={isLive} logoUrl={imgs.logo?.url} active="/maclar" />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h1 className="font-display gold-text text-5xl">Maçlar</h1>
        <p className="mt-2 max-w-2xl text-white/60">Yaklaşan maçlar ve canlı yorum yayınları. Saatler Türkiye saatine göredir.</p>
        <div className="mt-8">
          {items.length ? <MatchList items={items} /> : <Empty text="Yaklaşan maç yok." />}
        </div>
        <div className="mt-10"><Disclosure /></div>
      </main>
      <SiteFooter />
    </div>
  );
}

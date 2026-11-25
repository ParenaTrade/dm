import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { streams } from "@/db/schema";
import { Disclosure } from "@/components/site/Disclosure";
import { GameGrid, Empty } from "@/components/site/ContentCards";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ensureSeed } from "@/lib/seed";
import { getSiteImages } from "@/lib/site-images";
import { listItems } from "@/lib/site-content";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Berkbey — Oyunlar",
  description: "Berkbey yayınlarında oynanan oyunlar.",
};

export default async function Page() {
  await ensureSeed();
  const imgs = await getSiteImages();
  const [row] = await db.select().from(streams).orderBy(desc(streams.id)).limit(1);
  const isLive = row?.status === "live";
  const items = await listItems("game");
  return (
    <div className="relative overflow-x-hidden">
      <SiteHeader isLive={isLive} logoUrl={imgs.logo?.url} active="/oyunlar" />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h1 className="font-display gold-text text-5xl">Oyunlar</h1>
        <p className="mt-2 max-w-2xl text-white/60">Yayınlarda oynadığımız oyunlar. Ekran paylaşımıyla canlı izle, istersen sen de oyna.</p>
        <div className="mt-8">
          {items.length ? <GameGrid items={items} /> : <Empty text="Henüz oyun eklenmedi." />}
        </div>
        <div className="mt-10"><Disclosure /></div>
      </main>
      <SiteFooter />
    </div>
  );
}

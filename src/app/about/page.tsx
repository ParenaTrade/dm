import Link from "next/link";
import { Page } from "@/components/ui";
import { setting } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function About() {
  const bio = await setting("about");
  return (
    <Page>
      <div className="card overflow-hidden grid md:grid-cols-[320px_1fr]">
        <img src="/images/streamer.jpg" alt="Cenkbey" className="w-full h-full object-cover min-h-72" />
        <div className="p-6 md:p-10">
          <span className="badge bg-accent/20 text-accent2">Yayıncı</span>
          <h1 className="text-4xl font-black mt-2">Cenkbey</h1>
          <p className="text-white/80 mt-4 leading-relaxed whitespace-pre-line">{bio}</p>
          <div className="grid grid-cols-3 gap-3 mt-6 text-center">
            {[["🕗", "Her gün", "20:00"], ["🎰", "Kategori", "Slots & Oyun"], ["💬", "Topluluk", "Aktif sohbet"]].map(([i, a, b]) => (
              <div key={a} className="bg-white/5 rounded-xl p-3"><div className="text-2xl">{i}</div><div className="text-xs text-muted">{a}</div><div className="font-semibold text-sm">{b}</div></div>
            ))}
          </div>
          <div className="flex gap-2 mt-6"><Link href="/yayin/cenkbey" className="btn btn-red">Yayına git</Link><Link href="/ask" className="btn btn-ghost">Cenk'e sor</Link></div>
        </div>
      </div>
    </Page>
  );
}

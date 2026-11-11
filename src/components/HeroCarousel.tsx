"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Slide = { kind: "stream" | "sponsor"; title: string; sub: string; href: string; cta: string; color?: string; live: boolean };

export default function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (slides.length < 2) return; const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000); return () => clearInterval(t); }, [slides.length]);
  const s = slides[i];
  if (!s) return null;
  return (
    <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden border border-line">
      {s.kind === "stream"
        ? <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/images/hero.jpg)" }} />
        : <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 80% 30%, ${s.color}, #0b0b0f 70%)` }} />}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
      <div key={i} className="relative h-full flex flex-col justify-center p-6 md:p-10 max-w-xl pop">
        <span className="badge bg-white/10 w-fit mb-3">{s.kind === "stream" ? (s.live ? <><span className="live-dot" /> CANLI</> : "Yayıncı") : "Sponsor · Reklam"}</span>
        <h2 className="text-3xl md:text-4xl font-black leading-tight">{s.title}</h2>
        <p className="text-white/70 mt-2 text-sm md:text-base">{s.sub}</p>
        <Link href={s.href} target={s.kind === "sponsor" ? "_blank" : undefined} rel={s.kind === "sponsor" ? "sponsored noopener" : undefined} className="btn btn-red w-fit mt-5">{s.cta}</Link>
        {s.kind === "sponsor" && <span className="text-[10px] text-white/50 mt-2">18+ · Sorumlu oyna</span>}
      </div>
      <div className="absolute bottom-4 right-4 flex gap-1.5">
        {slides.map((_, k) => <button key={k} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-accent" : "w-3 bg-white/30"}`} aria-label={`Slayt ${k + 1}`} />)}
      </div>
    </div>
  );
}

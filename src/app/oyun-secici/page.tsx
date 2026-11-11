"use client";
import { useRef, useState } from "react";

const GAMES = ["Sweet Fiesta", "Gates of Olympos", "Big Bass Night", "Sugar Rush", "Wanted Dead", "Dog House", "Starlight Princess", "Fruit Party", "Zeus vs Hades", "Wild West Gold", "Madame Destiny", "Book of Ra", "Razor Shark", "Money Train", "Reactoonz", "Jammin Jars"];
const COLORS = ["#dc2626", "#7c3aed", "#0891b2", "#16a34a", "#ea580c", "#db2777", "#ca8a04", "#2563eb"];
const W = 160;

/** Animasyonlu rastgele oyun seçici (yalnızca eğlence; istemci tarafı). */
export default function Picker() {
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const strip = useRef(Array.from({ length: 6 }, () => GAMES).flat());

  const spin = () => {
    if (spinning) return;
    setPicked(null); setSpinning(true);
    const idx = Math.floor(Math.random() * GAMES.length);
    const target = (GAMES.length * 4 + idx) * W;
    setOffset(0);
    requestAnimationFrame(() => requestAnimationFrame(() => setOffset(target)));
    setTimeout(() => { setSpinning(false); setPicked(GAMES[idx]); }, 4200);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-black mb-1">🎰 Oyun Seçici</h1>
      <p className="text-sm text-muted mb-6">Yayında hangi oyuna geçileceğine kararsız mısın? Çarkı çevir!</p>
      <div className="card p-6 relative overflow-hidden">
        <div className="absolute left-1/2 top-2 bottom-2 w-1 bg-accent z-10 -translate-x-1/2 rounded shadow-[0_0_20px_#e11d2e]" />
        <div className="overflow-hidden">
          <div className="flex" style={{ transform: `translateX(calc(50% - ${offset + W / 2}px))`, transition: spinning && offset ? "transform 4s cubic-bezier(.12,.8,.2,1)" : "none" }}>
            {strip.current.map((g, k) => (
              <div key={k} className="shrink-0 px-1.5" style={{ width: W }}>
                <div className="h-44 rounded-xl grid place-items-center text-center p-3 font-bold border border-white/10" style={{ background: `linear-gradient(160deg, ${COLORS[GAMES.indexOf(g) % COLORS.length]}, #111)` }}>{g}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center mt-6">
          <button onClick={spin} disabled={spinning} className="btn btn-red px-10 py-3 text-base">{spinning ? "Dönüyor…" : "Oyun seç"}</button>
          {picked && <div className="mt-4 text-2xl font-black pop">🎉 {picked}</div>}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">{GAMES.map((g) => <div key={g} className="card p-2 text-xs text-center text-muted">{g}</div>)}</div>
    </div>
  );
}

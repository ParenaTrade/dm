"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export default function VerifyPage() {
  const [f, setF] = useState({ game: "dice", serverSeed: "", clientSeed: "", nonce: "0", mines: "3" });
  const [res, setRes] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState("");
  const run = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    try { setRes(await api(`/api/originals?verify=1&${new URLSearchParams(f)}`)); } catch (x) { setErr((x as Error).message); }
  };
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black mb-2">🔐 Adil Oyun Doğrulama</h1>
      <p className="text-sm text-muted mb-5">Sonuç = HMAC_SHA256(server_seed, &quot;client_seed:nonce:cursor&quot;). Seed&apos;ini değiştirdiğinde açıklanan önceki server seed ile geçmiş oyunlarını doğrulayabilirsin. Hash, oyun öncesi gösterilen değerle eşleşmelidir.</p>
      <form onSubmit={run} className="card p-5 space-y-3">
        <select className="input" value={f.game} onChange={(e) => setF({ ...f, game: e.target.value })}><option value="dice">Dice</option><option value="keno">Keno</option><option value="mines">Mines</option><option value="blackjack">Blackjack</option></select>
        <input className="input font-mono" placeholder="Server seed (açıklanmış)" value={f.serverSeed} onChange={(e) => setF({ ...f, serverSeed: e.target.value })} />
        <input className="input font-mono" placeholder="Client seed" value={f.clientSeed} onChange={(e) => setF({ ...f, clientSeed: e.target.value })} />
        <div className="flex gap-2"><input className="input" type="number" placeholder="Nonce" value={f.nonce} onChange={(e) => setF({ ...f, nonce: e.target.value })} />
          {f.game === "mines" && <input className="input" type="number" placeholder="Mayın" value={f.mines} onChange={(e) => setF({ ...f, mines: e.target.value })} />}</div>
        <button className="btn btn-red w-full">Doğrula</button>
        {err && <div className="text-sm text-red-400">{err}</div>}
        {res && <pre className="text-xs bg-black/40 p-3 rounded-lg overflow-x-auto">{JSON.stringify(res, null, 2)}</pre>}
      </form>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, fmt } from "@/lib/client";
import { useMe } from "./Shell";

type Round = { id: number; game: string; bet: number; status: string; payout: number; nonce: number; result: Record<string, unknown> | null; view?: Record<string, unknown> };
type Seeds = { serverSeedHash: string; clientSeed: string; nonce: number; prevServerSeed: string | null; prevServerSeedHash: string | null };
const GAMES = [
  { id: "dice", name: "Dice", icon: "🎲" }, { id: "keno", name: "Keno", icon: "🔢" },
  { id: "mines", name: "Mines", icon: "💣" }, { id: "blackjack", name: "Blackjack", icon: "🃏" },
] as const;
type G = (typeof GAMES)[number]["id"];

const SUITS = ["♠", "♥", "♦", "♣"], RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
function Card({ c, hidden }: { c?: number; hidden?: boolean }) {
  if (hidden || c === undefined) return <div className="w-14 h-20 rounded-lg bg-gradient-to-br from-accent to-red-900 border border-white/20 pop" />;
  const red = Math.floor(c / 13) === 1 || Math.floor(c / 13) === 2;
  return <div className={`w-14 h-20 rounded-lg bg-white grid place-items-center font-bold text-lg pop ${red ? "text-red-600" : "text-black"}`}>{RANKS[c % 13]}{SUITS[Math.floor(c / 13)]}</div>;
}

export default function Originals() {
  const { me, refresh, openAuth } = useMe();
  const [game, setGame] = useState<G>("dice");
  const [bet, setBet] = useState(10);
  const [seeds, setSeeds] = useState<Seeds | null>(null);
  const [recent, setRecent] = useState<Round[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(50), [over, setOver] = useState(false);
  const [picks, setPicks] = useState<number[]>([]);
  const [minesN, setMinesN] = useState(3);
  const [clientSeed, setClientSeed] = useState("");

  const load = useCallback(() => {
    if (!me) return;
    api<{ seeds: Seeds; active: Round[]; recent: Round[] }>("/api/originals").then((d) => {
      setSeeds(d.seeds); setRecent(d.recent); setClientSeed(d.seeds.clientSeed);
      const a = d.active.find((r) => r.game === game); if (a) setRound(a);
    }).catch(() => {});
  }, [me, game]);
  useEffect(() => { setRound(null); load(); }, [load]);

  const play = async (body: object) => {
    if (!me) return openAuth();
    setBusy(true); setErr("");
    try { const d = await api<{ round: Round }>("/api/originals", body); setRound(d.round); refresh(); if (d.round.status === "finished") load(); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const active = round?.status === "active" ? round : null;
  const r = round?.result as Record<string, number | boolean | number[] | string> | null;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      <div className="card p-5">
        <div className="flex gap-2 mb-5 flex-wrap">
          {GAMES.map((g) => <button key={g.id} onClick={() => setGame(g.id)} className={`btn ${game === g.id ? "btn-red" : "btn-ghost"}`}>{g.icon} {g.name}</button>)}
        </div>
        <div className="flex flex-wrap gap-3 items-end mb-5">
          <div><label className="label">Bahis (coin)</label><input type="number" className="input !w-32" min={10} max={5000} value={bet} onChange={(e) => setBet(Number(e.target.value))} disabled={!!active} /></div>
          {[["½", () => setBet(Math.max(10, Math.floor(bet / 2)))], ["2×", () => setBet(Math.min(5000, bet * 2))]].map(([l, f]) => <button key={l as string} onClick={f as () => void} disabled={!!active} className="btn btn-ghost">{l as string}</button>)}
          <span className="text-xs text-muted">Min 10 · Maks 5.000 · Günlük kayıp limiti 20.000</span>
        </div>

        {game === "dice" && (
          <div className="space-y-4">
            <div className="text-center text-6xl font-black tabular-nums py-6" key={round?.id}>
              <span className={r ? (r.win ? "text-green-400" : "text-red-400") : "text-white/30"}>{r && round?.game === "dice" ? Number(r.roll).toFixed(2) : "00.00"}</span>
            </div>
            <input type="range" min={2} max={98} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full accent-red-600" />
            <div className="flex flex-wrap gap-3 items-center text-sm">
              <button onClick={() => setOver(!over)} className="btn btn-ghost">{over ? `${target} üstü` : `${target} altı`} ⇄</button>
              <span className="text-muted">Şans: {(over ? 100 - target : target)}% · Çarpan: {(99 / (over ? 100 - target : target)).toFixed(4)}×</span>
              <div className="flex-1" />
              <button disabled={busy} onClick={() => play({ action: "dice", bet, target, over })} className="btn btn-red px-8">At</button>
            </div>
          </div>
        )}

        {game === "keno" && (
          <div className="space-y-4">
            <div className="grid grid-cols-8 gap-2">
              {Array.from({ length: 40 }, (_, k) => k + 1).map((n) => {
                const drawn = round?.game === "keno" && (r?.drawn as number[] | undefined)?.includes(n);
                const picked = picks.includes(n);
                return <button key={n} onClick={() => setPicks((p) => p.includes(n) ? p.filter((x) => x !== n) : p.length < 10 ? [...p, n] : p)}
                  className={`aspect-square rounded-lg font-bold text-sm transition ${picked && drawn ? "bg-green-500 pop" : picked ? "bg-accent" : drawn ? "bg-white/30" : "bg-white/5 hover:bg-white/10"}`}>{n}</button>;
              })}
            </div>
            <div className="flex gap-3 items-center text-sm">
              <span className="text-muted">{picks.length}/10 seçildi{round?.game === "keno" && r ? ` · İsabet: ${(r.hits as number[]).length} · ${r.multiplier}×` : ""}</span>
              <div className="flex-1" />
              <button onClick={() => setPicks([])} className="btn btn-ghost">Temizle</button>
              <button disabled={busy || picks.length === 0} onClick={() => play({ action: "keno", bet, picks })} className="btn btn-red px-8">Çek</button>
            </div>
          </div>
        )}

        {game === "mines" && (() => {
          const v = round?.game === "mines" ? (round.view as { revealed: number[]; mines?: number[]; multiplier: number; next: number }) : null;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
                {Array.from({ length: 25 }, (_, k) => {
                  const rev = v?.revealed.includes(k); const mine = v?.mines?.includes(k);
                  return <button key={k} disabled={!active || rev || busy} onClick={() => play({ action: "mines_reveal", roundId: active!.id, tile: k })}
                    className={`aspect-square rounded-xl text-2xl transition ${rev ? (mine ? "bg-red-600 pop" : "bg-green-600/80 pop") : mine ? "bg-red-900/50" : "bg-white/5 hover:bg-white/15"}`}>{rev ? (mine ? "💣" : "💎") : mine ? "💣" : ""}</button>;
                })}
              </div>
              <div className="flex flex-wrap gap-3 items-center text-sm justify-center">
                {!active ? <>
                  <label className="text-muted">Mayın</label>
                  <select className="input !w-20" value={minesN} onChange={(e) => setMinesN(Number(e.target.value))}>{Array.from({ length: 24 }, (_, k) => k + 1).map((n) => <option key={n}>{n}</option>)}</select>
                  <button disabled={busy} onClick={() => play({ action: "mines_start", bet, mines: minesN })} className="btn btn-red px-8">Başla</button>
                </> : <>
                  <span>Çarpan: <b>{v?.multiplier}×</b> · Sonraki: {v?.next}×</span>
                  <button disabled={busy || !v?.revealed.length} onClick={() => play({ action: "mines_cashout", roundId: active.id })} className="btn btn-red">Topla ({fmt(Math.floor(active.bet * (v?.multiplier ?? 0)))})</button>
                </>}
              </div>
            </div>
          );
        })()}

        {game === "blackjack" && (() => {
          const v = round?.game === "blackjack" ? (round.view as { player: number[]; dealer: number[]; playerValue: number; dealerValue: number }) : null;
          return (
            <div className="space-y-5 text-center">
              <div><div className="text-xs text-muted mb-2">Krupiye {v && `(${v.dealerValue})`}</div>
                <div className="flex gap-2 justify-center min-h-20">{v?.dealer.map((c, k) => <Card key={k} c={c} />)}{active && <Card hidden />}</div></div>
              <div><div className="text-xs text-muted mb-2">Sen {v && `(${v.playerValue})`}</div>
                <div className="flex gap-2 justify-center min-h-20">{v?.player.map((c, k) => <Card key={k} c={c} />)}</div></div>
              {round?.game === "blackjack" && r?.outcome && <div className="text-xl font-bold">{String(r.outcome)}</div>}
              <div className="flex gap-2 justify-center">
                {!active ? <button disabled={busy} onClick={() => play({ action: "bj_start", bet })} className="btn btn-red px-8">Dağıt</button> : <>
                  <button disabled={busy} onClick={() => play({ action: "bj_hit", roundId: active.id })} className="btn btn-ghost px-8">Kart çek</button>
                  <button disabled={busy} onClick={() => play({ action: "bj_stand", roundId: active.id })} className="btn btn-red px-8">Dur</button>
                </>}
              </div>
            </div>
          );
        })()}

        {round?.status === "finished" && <div className={`mt-5 text-center font-bold ${round.payout > 0 ? "text-green-400" : "text-muted"}`}>{round.payout > 0 ? `+${fmt(round.payout)} coin` : "Kazanç yok"}</div>}
        {err && <div className="mt-3 text-sm text-red-400 text-center">{err}</div>}
        <p className="text-[11px] text-muted text-center mt-6">🪙 Sanal coin – nakit değeri yoktur. Sonuçlar sunucuda üretilir ve doğrulanabilir.</p>
      </div>

      <div className="space-y-4">
        <div className="card p-4 text-xs space-y-2">
          <h3 className="font-bold text-sm">🔐 Provably Fair</h3>
          {seeds ? <>
            <div><span className="text-muted">Server seed hash:</span><div className="font-mono break-all">{seeds.serverSeedHash}</div></div>
            <div><span className="text-muted">Nonce:</span> {seeds.nonce}</div>
            <label className="label">Client seed</label>
            <div className="flex gap-2"><input className="input font-mono text-xs" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} />
              <button className="btn btn-ghost text-xs" onClick={async () => { try { await api("/api/originals", { action: "rotate_seed", clientSeed }); load(); } catch (e) { setErr((e as Error).message); } }}>Değiştir</button></div>
            <p className="text-muted">Seed değiştirince önceki server seed açıklanır.</p>
            {seeds.prevServerSeed && <div><span className="text-muted">Önceki server seed:</span><div className="font-mono break-all">{seeds.prevServerSeed}</div></div>}
            <Link href="/originals/verify" className="btn btn-ghost w-full">Doğrulama sayfası</Link>
          </> : <p className="text-muted">Görmek için giriş yap.</p>}
        </div>
        <div className="card p-4">
          <h3 className="font-bold text-sm mb-2">Son oyunlar</h3>
          {recent.map((x) => <div key={x.id} className="flex justify-between text-xs py-1 border-b border-line/50"><span>{x.game} · #{x.nonce}</span><span>{fmt(x.bet)}</span><span className={x.payout > 0 ? "text-green-400" : "text-muted"}>{x.status === "active" ? "aktif" : fmt(x.payout)}</span></div>)}
        </div>
      </div>
    </div>
  );
}

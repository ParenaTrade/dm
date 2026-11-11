"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import Chat from "../Chat";
import { useMe } from "../Shell";
import LiveStage, { ChannelState } from "./LiveStage";

type Full = ChannelState & { myGuest: { status: string } | null; isOwner: boolean; loggedIn: boolean; error?: string };

export default function StreamClient({ slug, initial }: { slug: string; initial: Full }) {
  const { me, refresh } = useMe();
  const [s, setS] = useState<Full>(initial);
  const [asGuest, setAsGuest] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => fetch(`/api/channel/${slug}`, { cache: "no-store" }).then((r) => r.json()).then((d: Full) => { if (!d.error) setS(d); }).catch(() => {}), [slug]);
  useEffect(() => { const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  // İzleme süresi heartbeat (giriş yapmış + yayın canlı)
  useEffect(() => {
    if (!me || !s.channel.isLive) return;
    const beat = () => api<{ awarded: number }>("/api/watch", { channelId: s.channel.id }).then((d) => { if (d.awarded) refresh(); }).catch(() => {});
    beat(); const t = setInterval(beat, 60_000); return () => clearInterval(t);
  }, [me, s.channel.isLive, s.channel.id, refresh]);

  const guestAct = async (action: "accept" | "decline" | "leave") => {
    try { await api("/api/guest", { channelId: s.channel.id, action }); if (action !== "accept") setAsGuest(false); load(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const g = s.myGuest;
  const canJoinAsGuest = g && (g.status === "accepted" || g.status === "live");
  const role = asGuest && canJoinAsGuest ? "guest" : "viewer";

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="flex-1 min-w-0 p-3 md:p-5 overflow-y-auto">
        {g?.status === "invited" && (
          <div className="mb-3 card p-3 flex flex-wrap items-center gap-3 border-accent/50">
            <span>🎙️ <b>{s.channel.hostName}</b> seni yayına konuk olarak davet etti.</span>
            <div className="flex-1" />
            <button onClick={() => guestAct("accept")} className="btn btn-red">Kabul et</button>
            <button onClick={() => guestAct("decline")} className="btn btn-ghost">Reddet</button>
          </div>
        )}
        {canJoinAsGuest && (
          <div className="mb-3 card p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm">{g!.status === "accepted" ? "Daveti kabul ettin. Kamera/mikrofon ile katılabilirsin; yayıncı onayladığında izleyicilere görünürsün." : "Yayıncı seni yayına aldı!"}</span>
            <div className="flex-1" />
            {!asGuest ? <button onClick={() => setAsGuest(true)} className="btn btn-red">📷 Konuk olarak katıl</button>
              : <button onClick={() => guestAct("leave")} className="btn btn-ghost">Yayından ayrıl</button>}
          </div>
        )}
        {msg && <div className="mb-3 text-sm text-red-400">{msg}</div>}

        <LiveStage key={role} role={role} state={s} />

        {/* Alt bilgi çubuğu */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <img src="/images/streamer.jpg" alt="" className="w-12 h-12 rounded-full object-cover border-2 border-accent" />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-lg truncate">{s.channel.title}</div>
            <div className="text-sm text-muted flex flex-wrap gap-x-3">
              <span className="text-white font-semibold">{s.channel.hostName}</span>
              <span>🎮 {s.channel.category}</span>
              {s.channel.isLive ? <span className="text-red-400">● Canlı · {s.channel.viewerCount} izleyici</span> : <span>Yayın kapalı</span>}
            </div>
          </div>
          <Link href="/bets" className="btn btn-ghost">📊 Tahminler</Link>
          <button onClick={() => setChatOpen((v) => !v)} className="btn btn-ghost hidden lg:inline-flex">💬 {chatOpen ? "Sohbeti gizle" : "Sohbet"}</button>
          {s.isOwner && <Link href="/studio" className="btn btn-red">🎥 Stüdyo</Link>}
        </div>
        {me && s.channel.isLive && <p className="text-xs text-muted mt-2">İzlerken dakikada 1 coin + 2 XP kazanırsın (günlük 120 dk sınır).</p>}
      </div>
      {chatOpen && (
        <aside className="lg:w-80 h-[420px] lg:h-auto shrink-0 border-t lg:border-t-0 lg:border-l border-line bg-panel flex flex-col">
          <div className="h-12 flex items-center px-4 border-b border-line font-semibold text-sm">Yayın Sohbeti</div>
          <Chat room={`channel:${s.channel.id}`} />
        </aside>
      )}
    </div>
  );
}

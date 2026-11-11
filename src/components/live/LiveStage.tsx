"use client";
/**
 * Canlı yayın sahnesi (host / guest / viewer ortak).
 *
 * Bileşen ağacı:
 *  LiveStage (container → requestFullscreen)
 *   ├─ MainVideo           yayıncının ScreenShare track'i (yoksa kamerası)
 *   ├─ PipGroup            köşeye yapışan, sürüklenebilir grup
 *   │   ├─ VideoTile       host kamerası (PiP)
 *   │   └─ VideoTile×≤3    konuk kameraları
 *   ├─ GameBadge           "Şu an oynanıyor: <oyun> – <sponsor>"
 *   ├─ SponsorOverlay      spotlight (logo, kod, Bonusu Al → /go/[slug])
 *   ├─ StatusBanner        yeniden bağlanıyor / koptu
 *   ├─ FullscreenChat      tam ekranda açılır/kapanır sohbet overlay'i
 *   └─ ControlBar          ses, kalite, gecikme, tam ekran (+ host/konuk yayın kontrolleri)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionQuality, ConnectionState, LocalTrack, RemoteAudioTrack, RemoteTrackPublication, Room, RoomEvent, Track, VideoQuality,
} from "livekit-client";
import { api, timeLeft } from "@/lib/client";
import Chat from "../Chat";

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type ChannelState = {
  channel: { id: number; slug: string; title: string; category: string; isLive: boolean; camPosition: string; viewerCount: number; hostIdentity: string; hostName: string; offlineBanner: string; lastLiveAt: string | null; startedAt: string | null };
  sponsor: { name: string; slug: string; promoCode: string | null; color: string; ctaText: string; category: string; until: string } | null;
  game: { title: string; sponsorName: string | null } | null;
  guests: { identity: string; username: string; status: string }[];
};
type TrackItem = { key: string; identity: string; name: string; source: Track.Source; track: Track; local: boolean; pub?: RemoteTrackPublication };

export default function LiveStage({ role, state, onCornerChange, autoConnect = true, onConnected }: {
  role: "host" | "guest" | "viewer"; state: ChannelState; onCornerChange?: (c: Corner) => void; autoConnect?: boolean; onConnected?: (room: Room | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [conn, setConn] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [quality, setQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown);
  const [err, setErr] = useState("");
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(role !== "viewer");
  const [vq, setVq] = useState<"auto" | "high" | "medium" | "low">("auto");
  const [fs, setFs] = useState(false);
  const [fsChat, setFsChat] = useState(false);
  const [corner, setCorner] = useState<Corner>((state.channel.camPosition as Corner) || "top-left");
  const [pipSize, setPipSize] = useState(1);
  const [retry, setRetry] = useState(0);
  const [, tick] = useState(0);

  useEffect(() => { setCorner((state.channel.camPosition as Corner) || "top-left"); }, [state.channel.camPosition]);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);

  const rebuild = useCallback(() => {
    const room = roomRef.current; if (!room) return setTracks([]);
    const items: TrackItem[] = [];
    room.remoteParticipants.forEach((p) => p.trackPublications.forEach((pub) => {
      if (pub.track && pub.isSubscribed) items.push({ key: pub.trackSid, identity: p.identity, name: p.name || p.identity, source: pub.source, track: pub.track, local: false, pub: pub as RemoteTrackPublication });
    }));
    room.localParticipant.trackPublications.forEach((pub) => {
      if (pub.track && pub.kind === Track.Kind.Video) items.push({ key: pub.trackSid, identity: room.localParticipant.identity, name: "Sen", source: pub.source, track: pub.track as LocalTrack, local: true });
    });
    setTracks(items);
  }, []);

  // ---- Bağlantı ----
  const shouldConnect = autoConnect && (role !== "viewer" || state.channel.isLive);
  useEffect(() => {
    if (!shouldConnect) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const evts = [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted];
    evts.forEach((e) => room.on(e, rebuild));
    room.on(RoomEvent.ConnectionStateChanged, (s) => setConn(s));
    room.on(RoomEvent.ConnectionQualityChanged, (q, p) => { if (p.identity === room.localParticipant.identity) setQuality(q); });
    (async () => {
      try {
        setErr("");
        const t = await api<{ token: string; url: string }>("/api/livekit/token", { channel: state.channel.slug, role });
        if (cancelled) return;
        await room.connect(t.url, t.token);
        if (role === "guest") { await room.localParticipant.setCameraEnabled(true); await room.localParticipant.setMicrophoneEnabled(true); }
        rebuild(); onConnected?.(room);
      } catch (e) { if (!cancelled) setErr((e as Error).message); }
    })();
    return () => { cancelled = true; room.disconnect(); roomRef.current = null; setTracks([]); onConnected?.(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldConnect, role, state.channel.slug, retry]);

  // ---- Tam ekran ----
  useEffect(() => {
    const h = () => setFs(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", h); return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : container.current?.requestFullscreen().catch(() => {}));

  // ---- Ses & kalite ----
  useEffect(() => {
    tracks.forEach((t) => { if (!t.local && t.track.kind === Track.Kind.Audio) (t.track as RemoteAudioTrack).setVolume(muted ? 0 : volume); });
  }, [tracks, volume, muted]);
  useEffect(() => {
    const map = { high: VideoQuality.HIGH, medium: VideoQuality.MEDIUM, low: VideoQuality.LOW };
    tracks.forEach((t) => { if (t.pub && t.track.kind === Track.Kind.Video && vq !== "auto") t.pub.setVideoQuality(map[vq]); });
  }, [tracks, vq]);

  const host = state.channel.hostIdentity;
  const video = tracks.filter((t) => t.track.kind === Track.Kind.Video);
  const screen = video.find((t) => t.identity === host && t.source === Track.Source.ScreenShare) ?? video.find((t) => t.source === Track.Source.ScreenShare);
  const hostCam = video.find((t) => t.identity === host && t.source === Track.Source.Camera);
  const main = screen ?? hostCam;
  const pipHost = screen ? hostCam : undefined;
  // Konuk, host onaylayana (status=live) kadar yalnızca host'a ve kendine görünür.
  const approved = (identity: string) => identity === host || role === "host" || state.guests.some((g) => g.identity === identity && g.status === "live");
  const guestCams = video.filter((t) => t.identity !== host && t.source === Track.Source.Camera && (t.local || approved(t.identity))).slice(0, 3);
  const audio = tracks.filter((t) => !t.local && t.track.kind === Track.Kind.Audio && approved(t.identity));
  const live = state.channel.isLive;

  return (
    <div ref={container} className={`relative bg-black overflow-hidden select-none ${fs ? "w-screen h-screen" : "w-full aspect-video rounded-xl border border-line"}`}>
      {main ? <VideoTile track={main.track} className="absolute inset-0 w-full h-full object-contain" mirror={false} />
        : <Placeholder live={live} conn={conn} state={state} role={role} err={err} />}
      {audio.map((a) => <AudioSink key={a.key} track={a.track} />)}

      {(pipHost || guestCams.length > 0) && (
        <PipGroup corner={corner} size={pipSize} container={container}
          onSnap={(c) => { setCorner(c); onCornerChange?.(c); }} onResize={() => setPipSize((s) => (s + 1) % 3)}>
          {pipHost && <Tile t={pipHost} label={state.channel.hostName} />}
          {guestCams.map((g) => <Tile key={g.key} t={g} label={state.guests.find((x) => x.identity === g.identity)?.username ?? g.name} />)}
        </PipGroup>
      )}

      {/* Üst bilgi */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
        {live ? <span className="badge bg-red-600 text-white"><span className="live-dot !bg-white" /> CANLI</span> : <span className="badge bg-zinc-700">Yayın kapalı</span>}
        {live && <span className="badge bg-black/60">👁 {state.channel.viewerCount}</span>}
      </div>
      {state.game && live && (
        <div className="absolute top-12 right-3 z-20 bg-black/70 backdrop-blur rounded-lg px-3 py-1.5 text-xs">🎮 Şu an oynanıyor: <b>{state.game.title}</b>{state.game.sponsorName && <> – {state.game.sponsorName}</>}</div>
      )}
      {state.sponsor && live && <SponsorOverlay s={state.sponsor} channelId={state.channel.id} />}

      {(conn === ConnectionState.Reconnecting || conn === ConnectionState.SignalReconnecting) && <Banner text="Bağlantı koptu, yeniden bağlanıyor…" />}
      {err && main === undefined && live && <Banner text={err} action={() => setRetry((r) => r + 1)} />}

      {fs && fsChat && <div className="absolute right-0 top-0 bottom-14 w-80 bg-black/75 backdrop-blur z-30 flex flex-col"><Chat room={`channel:${state.channel.id}`} compact /></div>}

      {/* Kontrol çubuğu */}
      <div className="absolute bottom-0 inset-x-0 z-30 flex items-center gap-2 px-3 py-2 bg-gradient-to-t from-black/90 to-transparent opacity-90 hover:opacity-100 text-sm">
        <button onClick={() => setMuted((m) => !m)} className="px-2" title="Ses">{muted || volume === 0 ? "🔇" : "🔊"}</button>
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }} className="w-20 accent-red-600" aria-label="Ses seviyesi" />
        <select value={vq} onChange={(e) => setVq(e.target.value as typeof vq)} className="bg-black/60 border border-white/10 rounded px-1 text-xs" aria-label="Kalite">
          <option value="auto">Otomatik</option><option value="high">1080p</option><option value="medium">720p</option><option value="low">360p</option>
        </select>
        {conn === ConnectionState.Connected && <span className="text-[11px] flex items-center gap-1" title="Bağlantı kalitesi">
          <span className={`w-2 h-2 rounded-full ${quality === ConnectionQuality.Excellent ? "bg-green-500" : quality === ConnectionQuality.Good ? "bg-yellow-400" : quality === ConnectionQuality.Poor ? "bg-red-500" : "bg-zinc-500"}`} /> Düşük gecikme
        </span>}
        <div className="flex-1" />
        {fs && <button onClick={() => setFsChat((v) => !v)} className="px-2" title="Sohbet">💬</button>}
        <button onClick={toggleFs} className="px-2" title="Tam ekran (ESC ile çık)">{fs ? "🗗" : "⛶"}</button>
      </div>
      {/* tick kullanımı: geri sayımların yeniden çizimi */}
    </div>
  );
}

function Tile({ t, label }: { t: TrackItem; label: string }) {
  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-white/20 shadow-xl bg-zinc-900">
      <VideoTile track={t.track} className="w-full h-full object-cover" mirror={t.local} />
      <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 px-1.5 rounded">{label}</span>
    </div>
  );
}

export function VideoTile({ track, className, mirror }: { track: Track; className?: string; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const el = ref.current; if (!el) return; track.attach(el); return () => { track.detach(el); }; }, [track]);
  return <video ref={ref} className={className} style={mirror ? { transform: "scaleX(-1)" } : undefined} autoPlay playsInline muted />;
}

function AudioSink({ track }: { track: Track }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { const el = ref.current; if (!el) return; track.attach(el); return () => { track.detach(el); }; }, [track]);
  return <audio ref={ref} autoPlay />;
}

const SIZES = ["18%", "25%", "33%"];
/** Sürüklenebilir PiP grubu: bırakıldığında en yakın köşeye yapışır. */
function PipGroup({ corner, size, container, onSnap, onResize, children }: { corner: Corner; size: number; container: React.RefObject<HTMLDivElement | null>; onSnap: (c: Corner) => void; onResize: () => void; children: React.ReactNode }) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef({ px: 0, py: 0, ox: 0, oy: 0 });
  const pos: React.CSSProperties = drag ? { left: drag.x, top: drag.y } : {
    [corner.startsWith("top") ? "top" : "bottom"]: corner.startsWith("top") ? 12 : 56,
    [corner.endsWith("left") ? "left" : "right"]: 12,
  };
  return (
    <div ref={ref} className={`absolute z-20 flex gap-2 cursor-grab active:cursor-grabbing touch-none ${corner.startsWith("bottom") && !drag ? "flex-col-reverse" : "flex-col"}`}
      style={{ width: SIZES[size], ...pos }}
      onPointerDown={(e) => {
        const c = container.current?.getBoundingClientRect(); const r = ref.current?.getBoundingClientRect(); if (!c || !r) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { px: e.clientX, py: e.clientY, ox: r.left - c.left, oy: r.top - c.top };
        setDrag({ x: r.left - c.left, y: r.top - c.top });
      }}
      onPointerMove={(e) => { if (!drag) return; setDrag({ x: start.current.ox + e.clientX - start.current.px, y: start.current.oy + e.clientY - start.current.py }); }}
      onPointerUp={() => {
        const c = container.current?.getBoundingClientRect(); const r = ref.current?.getBoundingClientRect();
        if (c && r && drag) {
          const cx = r.left - c.left + r.width / 2, cy = r.top - c.top + r.height / 2;
          onSnap(`${cy < c.height / 2 ? "top" : "bottom"}-${cx < c.width / 2 ? "left" : "right"}` as Corner);
        }
        setDrag(null);
      }}>
      {children}
      <button onPointerDown={(e) => e.stopPropagation()} onClick={onResize} className="self-end text-[10px] bg-black/60 rounded px-1.5" title="Boyutlandır">⤡ boyut</button>
    </div>
  );
}

function SponsorOverlay({ s, channelId }: { s: NonNullable<ChannelState["sponsor"]>; channelId: number }) {
  if (new Date(s.until) < new Date()) return null;
  return (
    <div className="absolute bottom-14 right-3 z-20 w-64 rounded-xl overflow-hidden shadow-2xl pop border border-white/10" style={{ background: `linear-gradient(135deg, ${s.color}, #111)` }}>
      <div className="p-3">
        <div className="flex items-center gap-2"><span className="w-9 h-9 rounded-lg bg-black/40 grid place-items-center font-black">{s.name[0]}</span><div><div className="text-[10px] uppercase opacity-80">Sponsor</div><div className="font-bold">{s.name}</div></div></div>
        {s.promoCode && <div className="mt-2 text-xs">Kod: <span className="font-mono font-bold bg-black/40 px-2 py-0.5 rounded">{s.promoCode}</span></div>}
        <a href={`/go/${s.slug}?ch=${channelId}`} target="_blank" rel="noopener noreferrer sponsored" className="btn bg-white text-black w-full mt-2 py-1.5">{s.ctaText}</a>
        <div className="flex justify-between text-[9px] opacity-75 mt-1"><span>{s.category === "casino" ? "18+ · Sorumlu oyna" : "Reklam"}</span><span>{timeLeft(s.until)}</span></div>
      </div>
    </div>
  );
}

function Banner({ text, action }: { text: string; action?: () => void }) {
  return <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-yellow-500/90 text-black text-xs font-semibold px-3 py-1.5 rounded-lg flex gap-2">{text}{action && <button onClick={action} className="underline">Tekrar dene</button>}</div>;
}

function Placeholder({ live, conn, state, role, err }: { live: boolean; conn: ConnectionState; state: ChannelState; role: string; err: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center text-center p-6" style={{ background: "radial-gradient(circle at 30% 20%, #3a0a10, #0b0b0f 70%)" }}>
      <div>
        {!live && role === "viewer" ? (<>
          <div className="text-4xl md:text-6xl font-black tracking-tight text-white/90">OFFLINE</div>
          <div className="mt-2 text-accent2 font-semibold">{state.channel.offlineBanner}</div>
          {state.channel.lastLiveAt && <div className="text-xs text-muted mt-2">Son yayın: {new Date(state.channel.lastLiveAt).toLocaleString("tr-TR")}</div>}
        </>) : err ? (<div className="text-sm text-red-300 max-w-md">{err}</div>)
          : conn === ConnectionState.Connected ? (<div className="text-muted text-sm">{role === "host" ? "Kamera veya ekran paylaşımını başlat." : "Yayıncının görüntüsü bekleniyor…"}</div>)
          : (<div className="text-muted text-sm animate-pulse">Bağlanıyor…</div>)}
      </div>
    </div>
  );
}

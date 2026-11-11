"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Room } from "livekit-client";
import { api } from "@/lib/client";
import LiveStage, { ChannelState, Corner } from "./LiveStage";

type Guest = { id: number; userId: string; status: string; username: string; canPublishAudio: boolean; canPublishVideo: boolean };
type Full = ChannelState & { allGuests?: Guest[] };
type Pred = { id: number; title: string; options: string[]; totalPool: number; closesAt: string; channelId: number | null };
type Ev = { id: number; type: string; createdAt: string };

export default function StudioClient({ initial, sponsors, games, predictions, events, livekitMissing }: {
  initial: Full; sponsors: { id: number; name: string; category: string }[]; games: { id: number; title: string; sponsorId: number }[];
  predictions: Pred[]; events: Ev[]; livekitMissing: string[];
}) {
  const router = useRouter();
  const [s, setS] = useState<Full>(initial);
  const [preview, setPreview] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [cam, setCam] = useState(false), [mic, setMic] = useState(false), [screen, setScreen] = useState(false);
  const [devices, setDevices] = useState<{ video: MediaDeviceInfo[]; audio: MediaDeviceInfo[] }>({ video: [], audio: [] });
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [invite, setInvite] = useState("");
  const [spId, setSpId] = useState(sponsors[0]?.id ?? 0), [spMin, setSpMin] = useState(5);
  const [gameId, setGameId] = useState(games[0]?.id ?? 0);
  const [form, setForm] = useState({ title: initial.channel.title, category: initial.channel.category, offlineBanner: initial.channel.offlineBanner });
  const [pred, setPred] = useState({ title: "", type: "yesno", options: "Evet, Hayır", minutes: 10 });

  const load = useCallback(() => fetch(`/api/channel/${s.channel.slug}`, { cache: "no-store" }).then((r) => r.json()).then((d) => !d.error && setS(d)), [s.channel.slug]);
  useEffect(() => { const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  const act = async (body: object, ok = "Kaydedildi") => {
    try { const r = await api<{ launchUrl?: string }>("/api/studio", body); setMsg({ t: ok, ok: true }); load(); router.refresh(); return r; }
    catch (e) { setMsg({ t: (e as Error).message, ok: false }); }
  };

  useEffect(() => {
    if (!room) { setCam(false); setMic(false); setScreen(false); return; }
    Promise.all([Room.getLocalDevices("videoinput"), Room.getLocalDevices("audioinput")]).then(([video, audio]) => setDevices({ video, audio })).catch(() => {});
  }, [room]);

  const toggle = async (kind: "cam" | "mic" | "screen") => {
    if (!room) return;
    try {
      const lp = room.localParticipant;
      if (kind === "cam") { await lp.setCameraEnabled(!cam); setCam(!cam); }
      if (kind === "mic") { await lp.setMicrophoneEnabled(!mic); setMic(!mic); }
      if (kind === "screen") { await lp.setScreenShareEnabled(!screen, { audio: true }); setScreen(!screen); }
    } catch (e) { setMsg({ t: `Cihaz hatası: ${(e as Error).message}`, ok: false }); }
  };

  const live = s.channel.isLive;
  const guests = s.allGuests ?? [];

  return (
    <div className="p-4 md:p-6 grid grid-cols-1 2xl:grid-cols-[1fr_380px] gap-5">
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">🎥 Yayıncı Stüdyosu</h1>
          {live ? <span className="badge bg-red-600"><span className="live-dot !bg-white" /> CANLI</span> : <span className="badge bg-zinc-700">Kapalı</span>}
          <div className="flex-1" />
          <a href={`/yayin/${s.channel.slug}`} target="_blank" className="btn btn-ghost">İzleyici görünümü ↗</a>
        </div>
        {livekitMissing.length > 0 && (
          <div className="card p-3 border-yellow-500/50 text-sm text-yellow-300">⚠️ LiveKit yapılandırılmamış. Eksik: <code>{livekitMissing.join(", ")}</code>. <code>.env</code> dosyasına ekleyip yeniden başlat. (Diğer stüdyo özellikleri çalışır.)</div>
        )}
        {msg && <div className={`text-sm ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.t}</div>}

        {preview ? <LiveStage role="host" state={s} onConnected={setRoom} onCornerChange={(c: Corner) => act({ action: "update", camPosition: c }, "Kamera konumu kaydedildi")} />
          : <div className="aspect-video card grid place-items-center"><button className="btn btn-red" onClick={() => setPreview(true)} disabled={livekitMissing.length > 0}>Önizlemeyi başlat (odaya bağlan)</button></div>}

        <div className="card p-4 flex flex-wrap items-center gap-2">
          <button disabled={!room} onClick={() => toggle("cam")} className={`btn ${cam ? "btn-red" : "btn-ghost"}`}>📷 Kamera {cam ? "açık" : "kapalı"}</button>
          <button disabled={!room} onClick={() => toggle("mic")} className={`btn ${mic ? "btn-red" : "btn-ghost"}`}>🎙️ Mikrofon {mic ? "açık" : "kapalı"}</button>
          <button disabled={!room} onClick={() => toggle("screen")} className={`btn ${screen ? "btn-red" : "btn-ghost"}`}>🖥️ {screen ? "Paylaşımı durdur" : "Ekran/sekme paylaş"}</button>
          <select disabled={!room} className="input !w-auto" onChange={(e) => room?.switchActiveDevice("videoinput", e.target.value)}>{devices.video.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Kamera"}</option>)}</select>
          <select disabled={!room} className="input !w-auto" onChange={(e) => room?.switchActiveDevice("audioinput", e.target.value)}>{devices.audio.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Mikrofon"}</option>)}</select>
          <div className="flex-1" />
          {live ? <button onClick={() => confirm("Yayını bitir?") && act({ action: "end_live" }, "Yayın bitirildi")} className="btn btn-ghost border border-red-500">⏹ Yayını bitir</button>
            : <button onClick={() => act({ action: "go_live" }, "Yayın başladı!")} className="btn btn-red">🔴 Yayını başlat</button>}
          {preview && <button onClick={() => setPreview(false)} className="btn btn-ghost">Bağlantıyı kes</button>}
        </div>
        <p className="text-xs text-muted">İpucu: Oyun yayını için “Ekran/sekme paylaş” ile oyun sekmesini seç. Kamera sol üstte PiP olarak görünür; sürükleyip köşeye bırakarak konumunu kaydedebilirsin. Önizlemeyi tam ekran yapmak için ⛶.</p>

        <div className="card p-4 grid md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2"><label className="label">Başlık</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="label">Kategori</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div><label className="label">Offline banner</label><input className="input" value={form.offlineBanner} onChange={(e) => setForm({ ...form, offlineBanner: e.target.value })} /></div>
          <button onClick={() => act({ action: "update", ...form })} className="btn btn-ghost md:col-span-4">Kanal ayarlarını kaydet</button>
        </div>
      </div>

      <div className="space-y-4">
        <section className="card p-4 space-y-3">
          <h2 className="font-bold">👥 Konuklar <span className="text-xs text-muted">(maks 3)</span></h2>
          <form onSubmit={(e) => { e.preventDefault(); act({ action: "invite", username: invite }, "Davet gönderildi").then(() => setInvite("")); }} className="flex gap-2">
            <input className="input" placeholder="kullanıcı adı" value={invite} onChange={(e) => setInvite(e.target.value)} />
            <button className="btn btn-red">Davet et</button>
          </form>
          {guests.length === 0 && <p className="text-xs text-muted">Konuk yok.</p>}
          {guests.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-2 text-sm bg-white/5 rounded-lg p-2">
              <b>{g.username}</b>
              <span className="badge bg-white/10">{({ invited: "davetli", accepted: "kabul etti", live: "yayında" } as Record<string, string>)[g.status] ?? g.status}</span>
              <div className="flex-1" />
              {g.status === "accepted" && <button onClick={() => act({ action: "approve", guestId: g.id }, "Konuk yayına alındı")} className="btn btn-red py-1 px-2 text-xs">Onayla</button>}
              {g.status === "live" && <>
                <button onClick={() => act({ action: "mute", guestId: g.id, source: "mic", muted: g.canPublishAudio })} className="btn btn-ghost py-1 px-2 text-xs">{g.canPublishAudio ? "🔇 Sustur" : "🎙️ Aç"}</button>
                <button onClick={() => act({ action: "mute", guestId: g.id, source: "camera", muted: g.canPublishVideo })} className="btn btn-ghost py-1 px-2 text-xs">{g.canPublishVideo ? "📷✕" : "📷"}</button>
              </>}
              <button onClick={() => act({ action: "remove", guestId: g.id }, "Konuk çıkarıldı")} className="btn btn-ghost py-1 px-2 text-xs text-red-400">Çıkar</button>
            </div>
          ))}
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="font-bold">⭐ Sponsor Spotlight</h2>
          {s.sponsor ? <div className="text-sm">Aktif: <b>{s.sponsor.name}</b> <button onClick={() => act({ action: "spotlight_clear" }, "Kapatıldı")} className="text-red-400 ml-2">kapat</button></div> : <p className="text-xs text-muted">Overlay kapalı.</p>}
          <div className="flex gap-2">
            <select className="input" value={spId} onChange={(e) => setSpId(Number(e.target.value))}>{sponsors.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.category})</option>)}</select>
            <select className="input !w-24" value={spMin} onChange={(e) => setSpMin(Number(e.target.value))}>{[1, 3, 5, 10, 15].map((m) => <option key={m} value={m}>{m} dk</option>)}</select>
          </div>
          <button onClick={() => act({ action: "spotlight", sponsorId: spId, minutes: spMin }, "Spotlight yayında")} className="btn btn-red w-full">Overlay'i göster</button>
          <p className="text-[11px] text-muted">Geo kuralları izleyici tarafında uygulanır: sponsorun gizli olduğu ülkelerde overlay görünmez.</p>
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="font-bold">🎮 Sponsor oyunu aç</h2>
          {s.game && <div className="text-sm">Oynanıyor: <b>{s.game.title}</b> <button onClick={() => act({ action: "clear_game" }, "Temizlendi")} className="text-red-400 ml-2">bitir</button></div>}
          <select className="input" value={gameId} onChange={(e) => setGameId(Number(e.target.value))}>{games.map((g) => <option key={g.id} value={g.id}>{g.title} – {sponsors.find((x) => x.id === g.sponsorId)?.name}</option>)}</select>
          <button onClick={async () => { const r = await act({ action: "open_game", gameId }, "Oyun açıldı – şimdi sekmeyi paylaş"); if (r?.launchUrl) window.open(r.launchUrl, "_blank", "noopener"); }} className="btn btn-ghost w-full">Yeni sekmede aç + overlay</button>
          <p className="text-[11px] text-muted">Üçüncü taraf siteler iframe'e izin vermediği için oyun yeni sekmede açılır; “Ekran/sekme paylaş” ile o sekmeyi yayınla.</p>
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="font-bold">📊 Tahminler</h2>
          <input className="input" placeholder="Soru (örn. Hunt 100x üstü mü?)" value={pred.title} onChange={(e) => setPred({ ...pred, title: e.target.value })} />
          <div className="flex gap-2">
            <select className="input" value={pred.type} onChange={(e) => setPred({ ...pred, type: e.target.value, options: e.target.value === "yesno" ? "Evet, Hayır" : "0-50x, 50-100x, 100x+" })}><option value="yesno">Evet/Hayır</option><option value="hunt">Hunt aralığı</option><option value="range">Aralık</option></select>
            <input className="input !w-24" type="number" value={pred.minutes} onChange={(e) => setPred({ ...pred, minutes: Number(e.target.value) })} title="Dakika" />
          </div>
          <input className="input" value={pred.options} onChange={(e) => setPred({ ...pred, options: e.target.value })} placeholder="Seçenekler (virgülle)" />
          <button onClick={() => act({ action: "prediction_create", title: pred.title, type: pred.type, options: pred.options.split(",").map((x) => x.trim()).filter(Boolean), minutes: pred.minutes }, "Tahmin açıldı")} className="btn btn-red w-full">Tahmin aç</button>
          {predictions.map((p) => (
            <div key={p.id} className="bg-white/5 rounded-lg p-2 text-sm">
              <div className="font-semibold">{p.title}</div>
              <div className="text-xs text-muted">Havuz: {p.totalPool} · Kapanış {new Date(p.closesAt).toLocaleTimeString("tr-TR")}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {p.options.map((o) => <button key={o} onClick={() => confirm(`Sonuç: ${o}?`) && act({ action: "prediction_settle", id: p.id, result: o }, "Sonuçlandırıldı")} className="btn btn-ghost py-1 px-2 text-xs">✓ {o}</button>)}
                <button onClick={() => confirm("İptal edip herkese iade et?") && act({ action: "prediction_settle", id: p.id, result: null }, "İade edildi")} className="btn btn-ghost py-1 px-2 text-xs text-red-400">İptal/iade</button>
              </div>
            </div>
          ))}
        </section>

        <section className="card p-4">
          <h2 className="font-bold mb-2">📜 Yayın olayları</h2>
          {events.map((e) => <div key={e.id} className="text-xs flex justify-between text-muted"><span>{e.type}</span><span>{new Date(e.createdAt).toLocaleString("tr-TR")}</span></div>)}
        </section>
      </div>
    </div>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { useMe } from "./Shell";

type Msg = { id: number; body: string; replyTo: number | null; pinned: boolean; createdAt: string; userId: string; username: string; level: number; role: string };
type Data = { messages: Msg[]; pinned: { id: number; body: string; username: string } | null; settings: { slowModeSeconds: number; minLevel: number }; me: { id: string; level: number; canModerate: boolean } | null };

const roleColor = (r: string) => (r === "admin" ? "text-accent2" : r === "mod" ? "text-green-400" : r === "host" ? "text-yellow-400" : "text-sky-300");

/** Sohbet: Supabase Realtime yerine 2.5 sn kısa yoklama (polling). React çıktıyı otomatik escape eder (XSS). */
export default function Chat({ room, compact = false }: { room: string; compact?: boolean }) {
  const { me, openAuth } = useMe();
  const [data, setData] = useState<Data | null>(null);
  const [older, setOlder] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Msg | null>(null);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const load = useCallback(() => api<Data>(`/api/chat?room=${encodeURIComponent(room)}`).then(setData).catch(() => {}), [room]);
  useEffect(() => { load(); const t = setInterval(load, 2500); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight; }, [data]);

  const all = [...older, ...(data?.messages ?? [])];
  const byId = new Map(all.map((m) => [m.id, m]));
  const locked = !!me && data?.me && !data.me.canModerate && me.level < (data.settings.minLevel ?? 3);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true); setErr("");
    try { await api("/api/chat", { room, body: text, replyTo: reply?.id }); setText(""); setReply(null); stick.current = true; load(); }
    catch (e) { setErr((e as Error).message); }
    setSending(false);
  }
  const mod = async (action: string, extra: object) => { try { await api("/api/chat/mod", { room, action, ...extra }); load(); } catch (e) { setErr((e as Error).message); } };
  const loadOlder = async () => {
    const first = all[0]; if (!first) return;
    const d = await api<Data>(`/api/chat?room=${encodeURIComponent(room)}&before=${first.id}`);
    setOlder((o) => [...d.messages, ...o]);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {data?.pinned && (
        <div className="m-2 p-2 rounded-lg bg-accent/10 border border-accent/30 text-xs">
          <div className="flex justify-between text-accent2 font-semibold">📌 Sabitlenmiş · {data.pinned.username}
            {data.me?.canModerate && data.pinned.id > 0 && <button onClick={() => mod("unpin", { messageId: data.pinned!.id })} className="text-muted">✕</button>}
          </div>
          <div className="mt-0.5 text-white/90">{data.pinned.body}</div>
        </div>
      )}
      <div ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }} className={`flex-1 overflow-y-auto px-3 py-2 space-y-1.5 ${compact ? "text-xs" : "text-sm"}`}>
        {all.length >= 60 && <button onClick={loadOlder} className="w-full text-xs text-muted hover:text-white py-1">Önceki mesajları yükle</button>}
        {all.map((m) => (
          <div key={m.id} className="group relative leading-snug break-words">
            {m.replyTo && byId.get(m.replyTo) && <div className="text-[11px] text-muted truncate">↪ @{byId.get(m.replyTo)!.username}: {byId.get(m.replyTo)!.body}</div>}
            <span className="badge bg-white/10 text-[10px] mr-1">{m.level}</span>
            <span className={`font-semibold ${roleColor(m.role)}`}>{m.username}</span>
            <span className="text-white/85">: {m.body}</span>
            <span className="absolute right-0 -top-1 hidden group-hover:flex gap-1 bg-card border border-line rounded px-1 text-xs">
              {me && <button title="Yanıtla" onClick={() => setReply(m)}>↩</button>}
              {data?.me?.canModerate && <>
                <button title="Sabitle" onClick={() => mod("pin", { messageId: m.id })}>📌</button>
                <button title="Sil" onClick={() => mod("delete", { messageId: m.id })}>🗑</button>
                <button title="10 dk sustur" onClick={() => mod("ban", { userId: m.userId, minutes: 10 })}>🔇</button>
                <button title="Kalıcı ban" onClick={() => confirm(`${m.username} kalıcı banlansın mı?`) && mod("ban", { userId: m.userId, minutes: 0 })}>⛔</button>
              </>}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-2">
        {data?.me?.canModerate && (
          <div className="flex items-center gap-2 mb-2 text-[11px] text-muted">
            Yavaş mod:
            <select className="bg-transparent border border-line rounded px-1" value={data.settings.slowModeSeconds} onChange={(e) => mod("slow", { seconds: Number(e.target.value) })}>
              {[0, 5, 10, 30, 60].map((s) => <option key={s} value={s} className="bg-card">{s ? `${s} sn` : "Kapalı"}</option>)}
            </select>
          </div>
        )}
        {reply && <div className="text-[11px] text-muted mb-1 flex justify-between">↪ @{reply.username} yanıtlanıyor <button onClick={() => setReply(null)}>✕</button></div>}
        {err && <div className="text-[11px] text-red-400 mb-1">{err}</div>}
        {!me ? (
          <button onClick={openAuth} className="btn btn-ghost w-full text-xs">Sohbet için giriş yap</button>
        ) : locked ? (
          <div className="text-center text-xs text-muted py-2 bg-white/5 rounded-lg">🔒 Mesaj için {data?.settings.minLevel}. seviyeye ulaş (şu an {me.level}). Yayın izleyerek XP kazan!</div>
        ) : (
          <form onSubmit={send} className="flex gap-2">
            <input className="input" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Mesaj yaz…" />
            <button disabled={sending} className="btn btn-red px-3">➤</button>
          </form>
        )}
      </div>
    </div>
  );
}

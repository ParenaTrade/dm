"use client";

import { useEffect, useRef, useState } from "react";
import { ROLE_LABELS, roleBadgeClass, type ChatMessageInfo } from "@/lib/types";

export function ChatPanel({
  messages,
  locked,
  slowModeSeconds,
  staff,
  onSend,
  onModerate,
  nickname,
  notice,
}: {
  messages: ChatMessageInfo[];
  locked: boolean;
  slowModeSeconds: number;
  staff: boolean;
  onSend: (text: string) => Promise<string | null>;
  onModerate: (action: string, messageId: number, targetUserId?: number) => void;
  nickname: string;
  notice: string | null;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    const err = await onSend(value);
    if (err) setError(err);
    else {
      setText("");
      setError(null);
      setCooldown(Math.max(2, slowModeSeconds));
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const pinned = [...messages].reverse().find((m) => m.isPinned && m.status === "visible");

  return (
    <div className="glass-dark flex h-full min-h-0 flex-col rounded-3xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <p className="font-display text-lg">Canlı Sohbet</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {locked && <span className="rounded-full bg-red-500/20 px-2 py-1 text-red-300">SOHBET KİLİTLİ</span>}
          {slowModeSeconds > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-1 text-amber-300">YAVAŞ MOD {slowModeSeconds}s</span>
          )}
          {!locked && slowModeSeconds === 0 && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">AÇIK</span>
          )}
        </div>
      </div>

      {pinned && (
        <div className="border-b border-gold/25 bg-gold/10 px-4 py-2 text-xs text-goldsoft">
          <span className="font-bold">📌 Sabitlenmiş:</span> {pinned.nickname}: {pinned.body.slice(0, 90)}
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="chat-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-white/40">
            Henüz mesaj yok. İlk yazan sen ol! 👋
          </p>
        )}
        {messages.map((message) => {
          const deleted = message.status === "deleted";
          return (
            <div key={message.id} className="group rounded-xl px-2 py-1 transition hover:bg-white/5">
              {deleted ? (
                <p className="text-xs italic text-white/35">
                  {staff ? "🗑 silinen mesaj: " : ""}
                  {staff ? `${message.nickname}: ${message.body}` : `${message.nickname} mesajı moderatör tarafından kaldırıldı.`}
                </p>
              ) : (
                <p className="text-sm leading-relaxed break-words">
                  <span
                    className={`mr-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${roleBadgeClass(message.role)}`}
                  >
                    {message.role === "host" ? "👑" : message.role === "moderator" ? "🛡" : message.role === "guest" ? "🎤" : ""}
                    {message.role === "viewer" ? "" : ROLE_LABELS[message.role] ?? ""}
                  </span>
                  <span className="font-bold" style={{ color: message.accent }}>
                    {message.nickname}
                  </span>
                  {message.isPinned && <span className="ml-1 text-gold">📌</span>}
                  <span className="text-white/80">: {message.body}</span>
                </p>
              )}

              {staff && !deleted && (
                <div className="mt-1 hidden gap-1 group-hover:flex">
                  <button
                    onClick={() => onModerate("delete", message.id, message.userId)}
                    className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] hover:bg-red-500/30"
                  >
                    Sil
                  </button>
                  <button
                    onClick={() => onModerate("pin", message.id)}
                    className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] hover:bg-gold/30"
                  >
                    {message.isPinned ? "Sabiti kaldır" : "Sabitle"}
                  </button>
                  <button
                    onClick={() => onModerate("mute", message.id, message.userId)}
                    className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] hover:bg-amber-500/30"
                  >
                    10dk Sustur
                  </button>
                  <button
                    onClick={() => onModerate("ban", message.id, message.userId)}
                    className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] hover:bg-red-600/40"
                  >
                    Uzaklaştır
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {notice && <p className="border-t border-white/10 px-4 py-2 text-xs text-goldsoft">{notice}</p>}

      <div className="border-t border-white/10 p-3">
        {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            rows={2}
            maxLength={400}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={locked && !staff ? "Sohbet kilitli..." : `${nickname} olarak mesaj yaz...`}
            disabled={locked && !staff}
            className="chat-scroll flex-1 resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-white/35 focus:border-gold/50"
          />
          <button
            onClick={() => void submit()}
            disabled={locked && !staff}
            className="btn-gold rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            {cooldown > 0 ? `${cooldown}` : "Gönder"}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1">
          {["😂", "🔥", "👑", "❤️", "🎰", "👏", "🤯", "💎"].map((emoji) => (
            <button
              key={emoji}
              onClick={() => setText((t) => `${t}${emoji}`)}
              className="rounded-lg bg-white/5 px-2 py-1 text-sm transition hover:bg-white/15"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

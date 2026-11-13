"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { VideoTile } from "./VideoTile";
import { useLiveEngine } from "./useLiveEngine";
import {
  joinStreamChannel,
  leaveStreamChannel,
  realtimeConfigured,
  setActiveSender,
  type PresencePayload,
  type StreamBroadcast,
} from "@/lib/realtime-client";
import type { ChatMessageInfo, ParticipantInfo, StreamInfo } from "@/lib/types";

type AppUser = {
  id: number;
  nickname: string;
  role: string;
  accent: string;
  isVip: boolean;
};

type Settings = {
  title: string;
  category: string;
  description: string;
  guestCode: string;
  slowModeSeconds: number;
  chatLocked: boolean;
  guestLimit: number;
};

const CATEGORIES = ["Sohbet", "Casino", "Oyun", "Konuk Programı", "Çekiliş", "Turnuva"];

export function LiveStudio() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [nickname, setNickname] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [showHostPass, setShowHostPass] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [me, setMe] = useState<ParticipantInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessageInfo[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [guestCodeInput, setGuestCodeInput] = useState("");
  const [guestDialog, setGuestDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [modInput, setModInput] = useState("");
  const [rtStatus, setRtStatus] = useState<"off" | "connecting" | "live" | "error">("off");
  const [presencePeers, setPresencePeers] = useState<PresencePayload[]>([]);
  const [settings, setSettings] = useState<Settings>({
    title: "",
    category: "Sohbet",
    description: "",
    guestCode: "",
    slowModeSeconds: 0,
    chatLocked: false,
    guestLimit: 3,
  });
  const [tick, setTick] = useState(0);

  const chatCursor = useRef(0);
  const channelRef = useRef<ReturnType<typeof joinStreamChannel> | null>(null);
  const userRef = useRef<AppUser | null>(null);
  userRef.current = user;

  const isHost = user?.role === "host";
  const isStaff = isHost || user?.role === "moderator";

  const realtimeLive = rtStatus === "live";

  const engine = useLiveEngine({
    streamId: stream?.id ?? null,
    userId: user?.id ?? null,
    isHost: Boolean(isHost),
    active: Boolean(user),
    realtimeMode: realtimeLive,
  });

  const engineRef = useRef(engine);
  engineRef.current = engine;
  const applyBroadcast = useCallback((event: StreamBroadcast) => {
    switch (event.type) {
      case "chat:new":
        setMessages((prev) => (prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message].slice(-300)));
        chatCursor.current = Math.max(chatCursor.current, event.message.id);
        break;
      case "chat:update":
        setMessages((prev) =>
          prev.map((m) => (event.ids.includes(m.id) ? { ...m, ...event.patch } : m)),
        );
        break;
      case "chat:clear":
        setMessages((prev) => prev.map((m) => ({ ...m, status: "deleted" })));
        break;
      case "signal":
        void engineRef.current.processSignal(event.from, event.kind, event.body);
        break;
      case "stage":
        setNotice(event.text);
        break;
    }
  }, []);

  /* ---------------- auth ---------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data.user) setUser(data.user);
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async () => {
    setAuthError(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, hostPassword: showHostPass ? hostPassword : undefined }),
    });
    const data = await res.json();
    if (!data.ok) {
      setAuthError(data.error ?? "Giriş başarısız");
      return;
    }
    setUser(data.user);
  };

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setUser(null);
    setMessages([]);
    chatCursor.current = 0;
    await engine.setMedia("off");
  };

  /* ---------------- api helper ---------------- */
  const streamAction = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => ({ ok: false, error: "Bağlantı hatası" }))) as {
      ok: boolean;
      error?: string;
      participant?: ParticipantInfo;
    };
  }, []);

  /* ---------------- join + polling ---------------- */
  useEffect(() => {
    if (!user) return;
    void streamAction({ action: "join", as: "viewer" });
  }, [user?.id, streamAction, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/stream", { cache: "no-store" });
        const data = await res.json();
        if (cancelled || !data.ok) return;
        setStream(data.stream as StreamInfo);
        setParticipants((data.participants ?? []) as ParticipantInfo[]);
        setMe(data.me ?? null);
        engine.syncParticipants(
          ((data.participants ?? []) as ParticipantInfo[])
            .filter((p) => p.status === "live")
            .map((p) => ({ userId: p.userId, status: p.status })),
        );
      } catch {
        /* noop */
      }
    };
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.id, engine, user]);

  /* ---------------- Supabase Realtime kanalı ---------------- */
  useEffect(() => {
    if (!user || !stream) return;
    const handle = joinStreamChannel({
      streamId: stream.id,
      userId: user.id,
      nickname: user.nickname,
      role: user.role,
      onEvent: applyBroadcast,
      onPresence: setPresencePeers,
      onStatus: setRtStatus,
    });
    channelRef.current = handle;
    setActiveSender(handle.send);
    if (!handle.configured) return;
    return () => {
      leaveStreamChannel(handle);
      channelRef.current = null;
      setPresencePeers([]);
      setRtStatus("off");
    };
  }, [user?.id, stream?.id, user, stream, applyBroadcast]);

  /* Sahne durumunu presence'a yaz (gerçek canlı izleyici/konuk listesi) */
  useEffect(() => {
    if (!realtimeLive || !channelRef.current || !user) return;
    channelRef.current.track({
      userId: user.id,
      nickname: user.nickname,
      role: me?.role ?? user.role,
      stage: me?.status === "live",
    });
  }, [realtimeLive, me?.role, me?.status, user?.id, user?.nickname, user?.role, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/chat?since=${chatCursor.current}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled || !data.ok) return;
        const incoming = (data.messages ?? []) as ChatMessageInfo[];
        if (incoming.length) {
          chatCursor.current = incoming[incoming.length - 1].id;
          setMessages((prev) => [...prev, ...incoming].slice(-300));
        }
      } catch {
        /* noop */
      }
    };
    void load();
    // Realtime bağlıyken polling sadece güvenlik ağı (ytSKU yakalama) olur.
    const timer = setInterval(() => void load(), realtimeLive ? 9000 : 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user?.id, user, realtimeLive]);

  useEffect(() => {
    if (!user || !me) return;
    const timer = setInterval(() => {
      void streamAction({
        action: "heartbeat",
        patch: {
          cameraOn: engine.mediaKind !== "off",
          micOn,
          handRaised,
          isScreenSharing: engine.mediaKind === "screen",
        },
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [user?.id, me?.id, engine.mediaKind, micOn, handRaised, streamAction, me, user]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!stream) return;
    setSettings({
      title: stream.title,
      category: stream.category,
      description: stream.description,
      guestCode: stream.guestCode,
      slowModeSeconds: stream.slowModeSeconds,
      chatLocked: stream.chatLocked,
      guestLimit: stream.guestLimit,
    });
  }, [stream?.id, stream]);

  /* ---------------- actions ---------------- */
  const startBroadcast = async () => {
    const res = await streamAction({ action: "start" });
    if (!res.ok) setNotice(res.error ?? "Yayın başlatılamadı");
    await engine.setMedia("camera");
    setCamOn(true);
    setMicOn(true);
    channelRef.current?.send({ type: "stage", text: "🔴 Yayın başladı! Berkbey sahnede." });
    setNotice("Yayın başladı! 🎬");
  };

  const stopBroadcast = async () => {
    await streamAction({ action: "stop" });
    await engine.setMedia("off");
    setCamOn(false);
    setMicOn(false);
    channelRef.current?.send({ type: "stage", text: "⚪ Yayın sonlandırıldı." });
    setNotice("Yayın sonlandırıldı.");
  };

  const requestGuest = async () => {
    const res = await streamAction({ action: "join", as: "guest", code: guestCodeInput });
    if (!res.ok) {
      setNotice(res.error ?? "Konuk isteği gönderilemedi");
      return;
    }
    setGuestDialog(false);
    setNotice("Konuk isteğin gönderildi, yayıncının onayı bekleniyor. 🎤");
  };

  const leaveStage = async () => {
    await engine.setMedia("off");
    setCamOn(false);
    setMicOn(false);
    await streamAction({ action: "join", as: "viewer" });
    setNotice("Konuk koltuğundan ayrıldın.");
  };

  const sendMessage = async (text: string): Promise<string | null> => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!data.ok) return data.error ?? "Mesaj gönderilemedi";
    if (data.message) {
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message].slice(-300)));
      chatCursor.current = Math.max(chatCursor.current, data.message.id);
      channelRef.current?.send({ type: "chat:new", message: data.message as ChatMessageInfo });
    }
    return null;
  };

  const moderate = async (action: string, messageId: number, targetUserId?: number) => {
    const res = await fetch("/api/chat/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, messageId, targetUserId }),
    });
    const data = await res.json();
    if (!data.ok) setNotice(data.error ?? "İşlem başarısız");
    else {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          if (action === "delete") return { ...m, status: "deleted" };
          if (action === "pin") return { ...m, isPinned: !m.isPinned };
          return m;
        }),
      );
      if (action === "delete") {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status: "deleted" } : m)));
        channelRef.current?.send({ type: "chat:update", ids: [messageId], patch: { status: "deleted" } });
        setNotice("Mesaj silindi.");
      }
      if (action === "pin") {
        const next = !messages.find((m) => m.id === messageId)?.isPinned;
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isPinned: Boolean(next) } : m)));
        channelRef.current?.send({ type: "chat:update", ids: [messageId], patch: { isPinned: Boolean(next) } });
        setNotice("Mesaj sabitlendi.");
      }
      if (action === "mute") setNotice("Kullanıcı 10 dk susturuldu.");
      if (action === "ban") setNotice("Kullanıcı yayından uzaklaştırıldı.");
    }
  };

  const clearChat = async () => {
    await fetch("/api/chat/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    setMessages([]);
    channelRef.current?.send({ type: "chat:clear" });
    setNotice("Sohbet temizlendi.");
  };

  const saveSettings = async () => {
    const res = await fetch("/api/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settings", settings }),
    });
    const data = await res.json();
    setNotice(data.ok ? "Yayın ayarları kaydedildi." : data.error ?? "Kaydedilemedi");
  };

  const addModerator = async () => {
    if (!modInput.trim()) return;
    const res = await fetch("/api/moderators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: modInput.trim() }),
    });
    const data = await res.json();
    if (data.ok) {
      setNotice(`${modInput.trim()} moderatör kadrosuna eklendi. 🛡`);
      setModInput("");
    } else setNotice(data.error ?? "Eklenemedi");
  };

  const admit = async (participantId: number) => {
    const target = waiting.find((p) => p.id === participantId);
    await streamAction({ action: "admit", participantId });
    channelRef.current?.send({
      type: "stage",
      text: `🎤 ${target?.nickname ?? "Konuk"} sahneye alındı!`,
    });
    setNotice("Konuk sahneye alındı.");
  };

  const kick = async (participantId: number) => {
    await streamAction({ action: "remove", participantId });
    setNotice("Katılımcı sahneden çıkarıldı.");
  };

  const muteAll = async () => {
    await streamAction({ action: "muteAll" });
    setNotice("Konukların mikrofonları kapatıldı.");
  };

  /* ---------------- derived ---------------- */
  const liveOthers = useMemo(
    () => participants.filter((p) => p.status === "live" && p.userId !== user?.id),
    [participants, user?.id],
  );
  const waiting = useMemo(() => participants.filter((p) => p.status === "waiting"), [participants]);
  // Realtime bağlıyken canlı sayısını presence'tan oku (milisaniye hassasiyeti)
  const liveCount =
    realtimeLive && presencePeers.length > 0
      ? presencePeers.length
      : participants.filter((p) => p.status === "live").length;

  const elapsed = useMemo(() => {
    void tick;
    if (!stream?.startedAt) return "";
    const diff = Math.max(0, Date.now() - new Date(stream.startedAt).getTime());
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [stream?.startedAt, tick]);

  const copyCode = () => {
    if (!stream) return;
    void navigator.clipboard?.writeText(stream.guestCode);
    setNotice(`Konuk kodu kopyalandı: ${stream.guestCode}`);
  };

  /* ---------------- views ---------------- */
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass animate-pulse rounded-3xl px-10 py-8 text-lg">Stüdyo hazırlanıyor...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="glass neon-ring w-full max-w-md rounded-3xl p-7">
          <p className="font-display gold-text text-3xl">Stüdyoya Gir</p>
          <p className="mt-2 text-sm text-white/60">
            Takma adını yaz, sohbete katıl. Konuk olmak için kod gerekiyor.
          </p>

          <div className="mt-6 space-y-3">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void login()}
              placeholder="Takma adın (örn. GoldFan)"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-gold/50"
            />
            {showHostPass && (
              <input
                value={hostPassword}
                onChange={(e) => setHostPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void login()}
                placeholder="Yayıncı şifresi"
                className="w-full rounded-xl border border-gold/30 bg-black/40 px-4 py-3 outline-none focus:border-gold"
              />
            )}
            <button
              onClick={() => setShowHostPass((v) => !v)}
              className="text-xs text-white/45 underline-offset-2 hover:underline"
            >
              {showHostPass ? "Yayıncı girişini kapat" : "Yayıncı (host) olarak giriş yap"}
            </button>
            {authError && <p className="text-sm text-red-300">{authError}</p>}
            <button onClick={() => void login()} className="btn-gold w-full rounded-xl py-3 font-bold">
              Yayına Katıl
            </button>
            <p className="text-center text-xs text-white/40">
              Demo yayıncı şifresi: <span className="text-gold">berkbey</span> · Konuk kodu:{" "}
              <span className="text-gold">BERK24</span>
            </p>
            <Link href="/" className="block text-center text-xs text-white/45 hover:text-gold">
              ← Ana sayfaya dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const myTileStream = engine.localStream;
  const myRole = me?.role ?? (isHost ? "host" : "viewer");

  return (
    <div className="mx-auto grid max-w-[1560px] gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_390px] lg:p-5">
      {/* LEFT */}
      <div className="min-w-0 space-y-4">
        {/* TOP BAR */}
        <div className="glass-dark flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm">
              ←
            </Link>
            <div className="min-w-0">
              <p className="truncate font-semibold">{stream?.title ?? "Berkbey Canlı Yayın"}</p>
              <p className="text-xs text-white/50">
                {stream?.category} · Yayıncı: {stream?.hostNickname}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold ${
                stream?.status === "live" ? "bg-red-600 text-white" : "bg-white/10 text-white/60"
              }`}
            >
              <span className={stream?.status === "live" ? "live-dot h-2 w-2 rounded-full bg-white" : "h-2 w-2 rounded-full bg-white/40"} />
              {stream?.status === "live" ? "CANLI" : "YAYIN DIŞI"}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">👁 {liveCount}</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">🎙 {liveOthers.filter((p) => p.role === "guest").length} konuk</span>
            {elapsed && <span className="rounded-full bg-white/10 px-3 py-1.5 tabular-nums">⏱ {elapsed}</span>}
            <span
              className={`rounded-full px-3 py-1.5 ring-1 ${
                realtimeLive
                  ? "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40"
                  : "bg-white/10 text-white/60 ring-white/20"
              }`}
              title={realtimeConfigured ? "Supabase Realtime" : "Supabase Realtime anahtarları tanımlı değil"}
            >
              {realtimeLive ? "⚡ REALTIME" : rtStatus === "connecting" ? "⚡ BAĞLANIYOR" : "↻ POOLING"}
            </span>
            <span className={`rounded-full px-3 py-1.5 ring-1 ${isStaff ? "bg-cyan-500/20 text-cyan-200 ring-cyan-400/40" : "bg-white/10 text-white/60"}`}>
              {isHost ? "Yayıncı" : user.role === "moderator" ? "Moderatör" : me?.role === "guest" ? "Konuk" : "İzleyici"}
            </span>
            {isStaff && (
              <button onClick={() => setShowSettings((v) => !v)} className="btn-ghost rounded-full px-3 py-1.5">
                ⚙ Ayarlar
              </button>
            )}
            <button onClick={() => void logout()} className="btn-ghost rounded-full px-3 py-1.5">
              Çıkış
            </button>
          </div>
        </div>

        {engine.error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {engine.error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-goldsoft">{notice}</p>
        )}

        {/* SETTINGS */}
        {showSettings && (
          <div className="glass-dark grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
            <label className="text-xs text-white/60">
              Yayın başlığı
              <input
                value={settings.title}
                onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-gold/50"
              />
            </label>
            <label className="text-xs text-white/60">
              Kategori
              <select
                value={settings.category}
                onChange={(e) => setSettings({ ...settings, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/60">
              Konuk kodu
              <input
                value={settings.guestCode}
                onChange={(e) => setSettings({ ...settings, guestCode: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-gold/50"
              />
            </label>
            <label className="text-xs text-white/60">
              Konuk koltuğu: {settings.guestLimit}
              <input
                type="range"
                min={0}
                max={6}
                value={settings.guestLimit}
                onChange={(e) => setSettings({ ...settings, guestLimit: Number(e.target.value) })}
                className="mt-2 w-full accent-amber-400"
              />
            </label>
            <label className="text-xs text-white/60">
              Yavaş mod (sn): {settings.slowModeSeconds}
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={settings.slowModeSeconds}
                onChange={(e) => setSettings({ ...settings, slowModeSeconds: Number(e.target.value) })}
                className="mt-2 w-full accent-amber-400"
              />
            </label>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.chatLocked}
                  onChange={(e) => setSettings({ ...settings, chatLocked: e.target.checked })}
                  className="h-4 w-4 accent-amber-400"
                />
                Sohbet kilidi
              </label>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <button onClick={() => void saveSettings()} className="btn-gold rounded-xl px-5 py-2 text-sm font-bold">
                Kaydet
              </button>
              {isHost && (
                <div className="flex flex-1 gap-2">
                  <input
                    value={modInput}
                    onChange={(e) => setModInput(e.target.value)}
                    placeholder="Moderatör ekle (takma ad)"
                    className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                  />
                  <button onClick={() => void addModerator()} className="btn-ghost rounded-xl px-4 py-2 text-sm">
                    🛡 Mod Yap
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STAGE */}
        <div className="rounded-3xl border border-white/10 bg-black/40 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className={liveOthers.length ? "md:col-span-2" : "md:col-span-2"}>
              <VideoTile
                stream={myTileStream}
                label={`${user.nickname} (sen)`}
                role={myRole}
                muted
                isLocal
                cameraOn={engine.mediaKind !== "off" && camOn}
                micOn={micOn}
                handRaised={handRaised}
                accent={user.accent}
              />
            </div>

            {liveOthers.map((p) => (
              <VideoTile
                key={p.id}
                stream={engine.remoteStreams[p.userId] ?? null}
                label={p.nickname}
                role={p.role}
                cameraOn={p.cameraOn || engine.mediaKind !== "off"}
                micOn={p.micOn}
                handRaised={p.handRaised}
                accent="#a855f7"
                state={engine.peerStates[p.userId]}
              />
            ))}
          </div>

          {me?.status === "waiting" && (
            <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              ⏳ Konuk isteğin bekleme listesinde. Yayıncı onaylayınca kameran sahneye düşecek.
            </div>
          )}

          {/* WAITING LIST */}
          {isStaff && waiting.length > 0 && (
            <div className="mt-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                Bekleyen konuk istekleri ({waiting.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {waiting.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 text-sm">
                    <span>🎤 {p.nickname}</span>
                    <button onClick={() => void admit(p.id)} className="rounded-lg bg-emerald-500/25 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/40">
                      Onayla
                    </button>
                    <button onClick={() => void kick(p.id)} className="rounded-lg bg-red-500/25 px-2 py-1 text-xs text-red-200 hover:bg-red-500/40">
                      Reddet
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LIVE PARTICIPANT MANAGEMENT */}
          {isStaff && liveOthers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {liveOthers.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-xs">
                  <span className={p.role === "guest" ? "text-fuchsia-300" : "text-white/70"}>
                    {p.role === "guest" ? "🎤" : "👤"} {p.nickname}
                  </span>
                  <span className="text-white/35">{engine.peerStates[p.userId] ?? "-"}</span>
                  {isHost && p.role === "guest" && (
                    <button onClick={() => void kick(p.id)} className="rounded-md bg-red-500/25 px-2 py-0.5 hover:bg-red-500/45">
                      çıkar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-3">
          {isHost ? (
            stream?.status === "live" ? (
              <button onClick={() => void stopBroadcast()} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold hover:bg-red-500">
                ⏹ Yayını Bitir
              </button>
            ) : (
              <button onClick={() => void startBroadcast()} className="btn-gold rounded-xl px-5 py-2.5 text-sm font-bold">
                ▶ Yayını Başlat
              </button>
            )
          ) : (
            <button
              onClick={() => setGuestDialog(true)}
              disabled={me?.role === "guest" || me?.status === "waiting"}
              className="btn-gold rounded-xl px-5 py-2.5 text-sm font-bold"
            >
              🎤 Konuk Ol
            </button>
          )}

          <button
            onClick={() => {
              const next = !micOn;
              if (engine.mediaKind === "off") {
                void engine.setMedia("camera");
                setCamOn(true);
                setMicOn(true);
              } else {
                engine.toggleAudio();
                setMicOn(next);
              }
            }}
            className={`btn-ghost rounded-xl px-4 py-2.5 text-sm ${micOn ? "text-white" : "text-red-300"}`}
          >
            {micOn ? "🎙 Mikrofon Açık" : "🔇 Mikrofon Kapalı"}
          </button>

          <button
            onClick={() => {
              if (engine.mediaKind === "off") {
                void engine.setMedia("camera");
                setCamOn(true);
              } else {
                engine.toggleVideo();
                setCamOn((c) => !c);
              }
            }}
            className={`btn-ghost rounded-xl px-4 py-2.5 text-sm ${camOn ? "text-white" : "text-red-300"}`}
          >
            {camOn ? "🎥 Kamera Açık" : "🚫 Kamera Kapalı"}
          </button>

          <button
            onClick={() => void engine.setMedia(engine.mediaKind === "screen" ? "camera" : "screen")}
            className="btn-ghost rounded-xl px-4 py-2.5 text-sm"
          >
            {engine.mediaKind === "screen" ? "🖥 Ekranı Kapat" : "🖥 Ekran Paylaş"}
          </button>

          <button
            onClick={() => setHandRaised((h) => !h)}
            className={`btn-ghost rounded-xl px-4 py-2.5 text-sm ${handRaised ? "text-amber-300" : ""}`}
          >
            ✋ {handRaised ? "Eldayım" : "El Kaldır"}
          </button>

          {isHost && (
            <>
              <button onClick={copyCode} className="btn-ghost rounded-xl px-4 py-2.5 text-sm">
                🔑 Konuk Kodu: {stream?.guestCode}
              </button>
              <button onClick={() => void muteAll()} className="btn-ghost rounded-xl px-4 py-2.5 text-sm">
                🔕 Herkesi Sustur
              </button>
              <button onClick={() => void clearChat()} className="btn-ghost rounded-xl px-4 py-2.5 text-sm">
                🧹 Sohbeti Temizle
              </button>
            </>
          )}

          {me?.role === "guest" && (
            <button onClick={() => void leaveStage()} className="btn-ghost rounded-xl px-4 py-2.5 text-sm text-red-300">
              ⤺ Koltuğu Bırak
            </button>
          )}

          <Link href="/panel" className="ml-auto rounded-xl bg-white/5 px-4 py-2.5 text-sm hover:bg-white/15">
            🛡 Moderatör Paneli
          </Link>
        </div>

        {/* GUEST DIALOG */}
        {guestDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="glass neon-ring w-full max-w-sm rounded-3xl p-6">
              <p className="font-display text-2xl text-gold">Konuk Davet Kodu</p>
              <p className="mt-2 text-sm text-white/60">
                Yayıncının paylaştığı kodu gir. Onaylanınca kameran ve mikrofonun sahneye eklenir.
              </p>
              <input
                value={guestCodeInput}
                onChange={(e) => setGuestCodeInput(e.target.value.toUpperCase())}
                placeholder="BERK24"
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-gold"
              />
              <div className="mt-4 flex gap-2">
                <button onClick={() => void requestGuest()} className="btn-gold flex-1 rounded-xl py-3 font-bold">
                  İstek Gönder
                </button>
                <button onClick={() => setGuestDialog(false)} className="btn-ghost rounded-xl px-5 py-3">
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: CHAT */}
      <div className="h-[70vh] min-h-[420px] lg:h-[calc(100vh-2.5rem)]">
        <ChatPanel
          messages={messages}
          locked={Boolean(stream?.chatLocked)}
          slowModeSeconds={stream?.slowModeSeconds ?? 0}
          staff={Boolean(isStaff)}
          nickname={user.nickname}
          notice={null}
          onSend={sendMessage}
          onModerate={(action, messageId, targetUserId) => void moderate(action, messageId, targetUserId)}
        />
      </div>
    </div>
  );
}

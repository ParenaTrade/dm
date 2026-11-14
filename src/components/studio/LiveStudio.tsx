"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { VideoTile } from "./VideoTile";
import { SelfPip } from "./SelfPip";
import { StageVideo } from "./StageVideo";
import { SystemStatusButton } from "../SystemStatusButton";
import { AuthForm } from "../AuthForm";
import { exchangeSession, getSessionEmail, onAuthChange, renameNickname, signOutAuth } from "@/lib/auth-client";
import { useLiveEngine } from "./useLiveEngine";
import {
  joinStreamChannel,
  leaveStreamChannel,
  realtimeConfigured,
  setActiveSender,
  type PresencePayload,
  type StreamBroadcast,
} from "@/lib/realtime-client";
import type { AppUser, ChatMessageInfo, ParticipantInfo, StreamInfo } from "@/lib/types";

type Settings = {
  title: string;
  category: string;
  description: string;
  slowModeSeconds: number;
  chatLocked: boolean;
  guestLimit: number;
};

const CATEGORIES = ["Sohbet", "Spor", "Maç Yorumu", "Oyun", "Eğlence", "Konuk Programı", "Çekiliş"];

export function LiveStudio() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [swapStage, setSwapStage] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [me, setMe] = useState<ParticipantInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessageInfo[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [guestCamOff, setGuestCamOff] = useState(false);
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
    slowModeSeconds: 0,
    chatLocked: false,
    guestLimit: 3,
  });
  const [tick, setTick] = useState(0);

  const autoMediaRef = useRef(false);
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
    realtimeMode: false, // WebRTC sinyalleri güvenilir REST kuyruğundan; anlık durum için Realtime 'state' olayı
  });

  const engineRef = useRef(engine);
  engineRef.current = engine;
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
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
      case "state":
        void refreshRef.current();
        break;
    }
  }, []);

  /* ---------------- auth (e-posta + şifre, e-posta onaylı) ---------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth", { cache: "no-store" });
        const data = await res.json();
        if (data.user) {
          // Aynı tarayıcıda başka hesapla girilmişse (Supabase oturumu farklıysa) güncel hesaba geç.
          const sessionEmail = await getSessionEmail();
          if (sessionEmail && sessionEmail !== String(data.user.email).toLowerCase()) {
            const swapped = await exchangeSession();
            if (!cancelled && swapped?.user) {
              setUser(swapped.user);
              return;
            }
          }
          if (!cancelled) setUser(data.user as AppUser);
          return;
        }
        const exchanged = await exchangeSession();
        if (cancelled) return;
        if (exchanged?.user) setUser(exchanged.user);
        else if (exchanged?.error) setAuthError(exchanged.error);
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

  /* Başka sekmede hesap değişirse bu sekme de aynı hesaba geçsin (rol karışmasın). */
  useEffect(() => {
    return onAuthChange((event, email) => {
      const current = userRef.current;
      if (event === "SIGNED_OUT") {
        if (current) {
          void fetch("/api/auth", { method: "DELETE" });
          setUser(null);
          setMe(null);
        }
        return;
      }
      if (email && current && email !== current.email.toLowerCase()) {
        void exchangeSession().then((res) => {
          if (res?.user) {
            autoMediaRef.current = false;
            setUser(res.user);
            setMe(null);
          }
        });
      }
    });
  }, []);

  /* Giriş ekranında aktif yayın odasını göster */
  useEffect(() => {
    if (user || authLoading) return;
    void fetch("/api/stream", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.ok && setStream(d.stream as StreamInfo))
      .catch(() => undefined);
  }, [user, authLoading]);

  const logout = async () => {
    engine.stopScreen();
    await engine.setMedia("off");
    await fetch("/api/auth", { method: "DELETE" });
    await signOutAuth();
    autoMediaRef.current = false;
    setUser(null);
    setStream(null);
    setMe(null);
    setMessages([]);
    setCamOn(false);
    setMicOn(false);
    chatCursor.current = 0;
  };

  /* ---------------- api helper ---------------- */
  const streamAction = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await res.json().catch(() => ({ ok: false, error: "Bağlantı hatası" }))) as {
      ok: boolean;
      error?: string;
      participant?: ParticipantInfo;
    };
    // Durumu değiştiren işlemler herkese anında duyurulur (Realtime) ve kendimiz hemen yenileriz.
    const mutating = ["start", "stop", "join", "admit", "remove", "layout", "settings", "muteAll", "leave"];
    if (result.ok && mutating.includes(String(body.action))) {
      channelRef.current?.send({ type: "state" });
      void refreshRef.current();
    }
    return result;
  }, []);

  /* ---------------- join + polling ---------------- */
  useEffect(() => {
    if (!user) return;
    void streamAction({ action: "join", as: "viewer" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refreshStream = useCallback(async () => {
    try {
      const res = await fetch("/api/stream", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) return;
      const list = (data.participants ?? []) as ParticipantInfo[];
      setStream(data.stream as StreamInfo);
      setParticipants(list);
      setMe(data.me ?? null);
      const live = list.filter((p) => p.status === "live");
      engineRef.current.syncParticipants(live.map((p) => ({ userId: p.userId, status: p.status, role: p.role })));
      engineRef.current.setRelaySources(
        live.filter((p) => p.role === "moderator" || p.role === "guest").map((p) => p.userId),
      );
    } catch {
      /* noop */
    }
  }, []);
  refreshRef.current = refreshStream;

  useEffect(() => {
    if (!user?.id) return;
    void refreshStream();
    const timer = setInterval(() => void refreshStream(), 1500);
    const onVisible = () => document.visibilityState === "visible" && void refreshStream();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, refreshStream]);

  /* ---------------- Supabase Realtime kanalı ---------------- */
  useEffect(() => {
    const current = userRef.current;
    if (!current || !stream) return;
    const handle = joinStreamChannel({
      streamId: stream.id,
      userId: current.id,
      nickname: current.nickname,
      role: current.role,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, stream?.id, applyBroadcast]);

  /* Sahne durumunu presence'a yaz (gerçek canlı izleyici/konuk listesi) */
  useEffect(() => {
    if (!realtimeLive || !channelRef.current || !user) return;
    channelRef.current.track({
      userId: user.id,
      nickname: user.nickname,
      role: me?.role ?? user.role,
      stage: me?.status === "live",
    });
  }, [realtimeLive, me?.role, me?.status, user?.id, user?.nickname, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [user?.id, realtimeLive]); // eslint-disable-line react-hooks/exhaustive-deps

  const hbRef = useRef({ cameraOn: false, micOn: false, handRaised: false, screen: false });
  hbRef.current = {
    cameraOn: engine.mediaKind !== "off" && camOn,
    micOn: engine.mediaKind !== "off" && micOn,
    handRaised,
    screen: Boolean(engine.screenStream),
  };
  const hasMe = Boolean(me);
  const sendHeartbeat = useCallback(() => {
    const h = hbRef.current;
    void streamAction({
      action: "heartbeat",
      patch: { cameraOn: h.cameraOn, micOn: h.micOn, handRaised: h.handRaised, isScreenSharing: h.screen },
    });
  }, [streamAction]);

  // Düzenli kalp atışı: katılımcı "canlı" kalsın (effect bağımlılıkları kararlı, süre dolmaz).
  useEffect(() => {
    if (!user?.id || !hasMe) return;
    const timer = setInterval(sendHeartbeat, 4000);
    return () => clearInterval(timer);
  }, [user?.id, hasMe, sendHeartbeat]);

  // Kamera/mikrofon/ekran/el durumu değişince hemen bildir.
  useEffect(() => {
    if (!user?.id || !hasMe) return;
    sendHeartbeat();
  }, [user?.id, hasMe, camOn, micOn, handRaised, engine.mediaKind, engine.screenStream, sendHeartbeat]);

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
      slowModeSeconds: stream.slowModeSeconds,
      chatLocked: stream.chatLocked,
      guestLimit: stream.guestLimit,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream?.id]);

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
    engine.stopScreen();
    await engine.setMedia("off");
    setCamOn(false);
    setMicOn(false);
    channelRef.current?.send({ type: "stage", text: "⚪ Yayın sonlandırıldı." });
    setNotice("Yayın sonlandırıldı.");
  };

  const requestGuest = async () => {
    const res = await streamAction({ action: "join", as: "guest" });
    if (!res.ok) {
      setNotice(res.error ?? "Konuk isteği gönderilemedi");
      return;
    }
    setGuestDialog(false);
    setNotice("Konuk isteğin gönderildi, yayıncı/moderatör onayı bekleniyor. 🎤");
  };

  const leaveStage = async () => {
    await engine.setMedia("off");
    setCamOn(false);
    setMicOn(false);
    autoMediaRef.current = false;
    await streamAction({ action: "join", as: "demote" });
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
      body: JSON.stringify({ email: modInput.trim() }),
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

  const onStageGuest = me?.role === "guest" && me.status === "live";
  const isMod = user?.role === "moderator";
  // Popup kameraları (tek tık: gizle / canlı ekrana tek tık: göster)
  const [popupsHidden, setPopupsHidden] = useState(false);
  // Moderatör cihazında dinleme: varsayılan KAPALI (aynı odada yayıncı laptopu ile çınlama/uğultu yapmasın)
  const [listenPref, setListenPref] = useState<boolean | null>(null);
  const listenOff = listenPref ?? isMod;

  // Canlı ekran tam ekran (tarayıcı Fullscreen API; desteklemeyen telefonlarda CSS tam ekran)
  const stageRef = useRef<HTMLDivElement>(null);
  const [apiFs, setApiFs] = useState(false);
  const [cssFs, setCssFs] = useState(false);
  const fsActive = apiFs || cssFs;
  useEffect(() => {
    const onChange = () => {
      const d = document as Document & { webkitFullscreenElement?: Element | null };
      setApiFs(Boolean(d.fullscreenElement ?? d.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);
  useEffect(() => {
    if (!cssFs) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCssFs(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cssFs]);
  const toggleFullscreen = async () => {
    const d = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    if (cssFs) {
      setCssFs(false);
      return;
    }
    if (d.fullscreenElement ?? d.webkitFullscreenElement) {
      try {
        await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      } catch {
        /* noop */
      }
      return;
    }
    const el = stageRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else setCssFs(true);
    } catch {
      setCssFs(true);
    }
  };

  /* Moderatör (yayını sunan kişi) canlı yayın varken kamerasını otomatik açar (mikrofon kapalı başlar).
     Sahneye alınan konuk kamerasını açar (yüzünü göstermek istemiyorsa kapalı kalır).
     Yenilemeden sonra yayıncı kamerası kendiliğinden geri gelir. */
  const streamLive = stream?.status === "live";
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (isHost) {
      if (!streamLive) {
        resumedRef.current = false;
        return;
      }
      if (resumedRef.current || engine.mediaKind !== "off") return;
      resumedRef.current = true;
      void engine.setMedia("camera").then(() => {
        setCamOn(true);
        setMicOn(true);
      });
      return;
    }
    const wantsMedia = (isMod && streamLive) || onStageGuest;
    if (wantsMedia) {
      if (autoMediaRef.current) return;
      autoMediaRef.current = true;
      const videoOff = !isMod && guestCamOff;
      void engine.setMedia("camera", { muted: isMod, videoOff }).then(() => {
        setCamOn(!videoOff);
        setMicOn(!isMod);
      });
    } else if (autoMediaRef.current) {
      autoMediaRef.current = false;
      void engine.setMedia("off");
      setCamOn(false);
      setMicOn(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isHost, isMod, streamLive, onStageGuest, guestCamOff]);

  /** Ekran düzeni: yayıncı/moderatör popup'a çift tıklayınca herkes için değişir (Realtime). */
  const setFocus = async (focus: "screen" | "mod" | "host") => {
    if (!isStaff) return;
    setStream((prev) => (prev ? { ...prev, stageLayout: focus } : prev));
    await streamAction({ action: "layout", focus });
  };

  const submitRename = async () => {
    setRenameError(null);
    const res = await renameNickname(renameValue);
    if (res.error) return setRenameError(res.error);
    if (res.user) setUser(res.user);
    setRenameOpen(false);
    setNotice("Rumuzun güncellendi.");
  };

  const toggleMic = () => {
    if (engine.mediaKind === "off") {
      void engine.setMedia("camera");
      setCamOn(true);
      setMicOn(true);
    } else {
      engine.toggleAudio();
      setMicOn((v) => !v);
    }
  };

  const toggleCam = () => {
    if (engine.mediaKind === "off") {
      void engine.setMedia("camera");
      setCamOn(true);
    } else {
      engine.toggleVideo();
      setCamOn((c) => !c);
    }
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
    const roomLive = stream?.status === "live";
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="glass neon-ring w-full max-w-md rounded-3xl p-7">
          <p className="font-display gold-text text-3xl">Stüdyoya Gir</p>
          <p className="mt-2 text-sm text-white/60">
            Yayıncı, moderatör, konuk ve izleyici girişi e-posta ve şifre ile yapılır. Aşağıdaki canlı yayın odasına
            tıklayarak giriş yap veya kayıt ol.
          </p>

          <button
            onClick={() => setRoomOpen((v) => !v)}
            className="mt-6 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/40 p-4 text-left transition hover:border-gold/60"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{stream?.title ?? "Berkbey Canlı Yayın"}</span>
              <span className="mt-1 flex items-center gap-2 text-xs text-white/55">
                <span className={`h-2 w-2 rounded-full ${roomLive ? "live-dot bg-red-500" : "bg-white/40"}`} />
                {roomLive ? "Canlı yayın odası aktif" : "Yayın odası (şu an yayın dışı)"}
              </span>
            </span>
            <span className="shrink-0 rounded-xl bg-gold px-3 py-2 text-xs font-bold text-black">
              {roomOpen ? "Kapat" : "Odaya gir"}
            </span>
          </button>

          {authError && <p className="mt-3 text-sm text-red-300">{authError}</p>}
          {roomOpen && (
            <div className="mt-4">
              <AuthForm onDone={(u) => setUser(u)} />
            </div>
          )}
          <Link href="/" className="mt-5 block text-center text-xs text-white/45 hover:text-gold">
            ← Ana sayfaya dön
          </Link>
        </div>
      </div>
    );
  }

  const hostP = participants.find((p) => p.role === "host" && p.status === "live");
  const canPublish = isHost || isMod || onStageGuest;
  const showPip = !isHost && onStageGuest;
  const stageOthers = liveOthers.filter((p) => p.role === "guest");

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

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold ${
                stream?.status === "live" ? "bg-red-600 text-white" : "bg-white/10 text-white/60"
              }`}
            >
              <span className={stream?.status === "live" ? "live-dot h-2 w-2 rounded-full bg-white" : "h-2 w-2 rounded-full bg-white/40"} />
              {stream?.status === "live" ? "CANLI" : "YAYIN DIŞI"}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">👁 {liveCount}</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              🎙 {participants.filter((p) => p.status === "live" && p.role === "guest").length} konuk
            </span>
            {elapsed && <span className="rounded-full bg-white/10 px-3 py-1.5 tabular-nums">⏱ {elapsed}</span>}
            {isStaff ? (
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
            ) : (
              <SystemStatusButton />
            )}
            <button
              onClick={() => {
                setRenameValue(user.nickname);
                setRenameError(null);
                setRenameOpen(true);
              }}
              title="Rumuzunu değiştir"
              className={`rounded-full px-3 py-1.5 ring-1 ${isStaff ? "bg-cyan-500/20 text-cyan-200 ring-cyan-400/40" : "bg-white/10 text-white/60"}`}
            >
              {isHost ? "Yayıncı" : isMod ? "Moderatör" : me?.role === "guest" ? "Konuk" : "İzleyici"} · {user.nickname} ✎
            </button>
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
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">{engine.error}</p>
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
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button onClick={() => void saveSettings()} className="btn-gold rounded-xl px-5 py-2 text-sm font-bold">
                Kaydet
              </button>
              {isHost && (
                <div className="flex flex-1 gap-2">
                  <input
                    value={modInput}
                    onChange={(e) => setModInput(e.target.value)}
                    placeholder="Moderatör ekle (e-posta)"
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

        {/* STAGE: ana ekran = oyun/maç/ekran yayını; yayıncı yüzü sol üstte, moderatör sağ üstte kare popup (popup'a tek tık: gizle, canlı ekrana tek tık: göster) */}
        <div className="rounded-3xl border border-white/10 bg-black/40 p-3">
          {(() => {
            const live = stream?.status === "live";
            const hostName = isHost ? user.nickname : (hostP?.nickname ?? stream?.hostNickname ?? "Yayıncı");
            const modP = participants.find((p) => p.role === "moderator" && p.status === "live" && p.cameraOn);
            const iAmPresenter = Boolean(modP && modP.userId === user.id);

            type Src = {
              stream: MediaStream | null;
              label: string;
              fit: "cover" | "contain";
              showVideo: boolean;
              mirror: boolean;
              muted: boolean;
              fallback: React.ReactNode;
            };
            const avatar = (name: string) => (
              <div className="flex flex-col items-center gap-1">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl font-bold">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-[11px]">Kamera kapalı</span>
              </div>
            );

            const sources: Partial<Record<"screen" | "mod" | "host", Src>> = {};
            const screenStream = isHost ? engine.screenStream : hostP ? (engine.remoteScreens[hostP.userId] ?? null) : null;
            if (screenStream) {
              sources.screen = {
                stream: screenStream,
                label: "🎮 Canlı Ekran (oyun / maç)",
                fit: "contain",
                showVideo: true,
                mirror: false,
                muted: isHost,
                fallback: <span className="text-sm">Ekran yükleniyor...</span>,
              };
            }
            if (modP) {
              sources.mod = {
                stream: iAmPresenter ? engine.localStream : (engine.remoteStreams[modP.userId] ?? null),
                label: `🛡 ${modP.nickname}`,
                fit: "cover",
                showVideo: iAmPresenter ? camOn && engine.mediaKind !== "off" : modP.cameraOn,
                mirror: iAmPresenter,
                muted: iAmPresenter,
                fallback: avatar(modP.nickname),
              };
            }
            if (isHost || hostP) {
              sources.host = {
                stream: isHost ? engine.localStream : (engine.remoteStreams[hostP!.userId] ?? null),
                label: `${hostName} (yayıncı)`,
                fit: "cover",
                showVideo: isHost ? engine.mediaKind !== "off" && camOn : Boolean(hostP?.cameraOn),
                mirror: isHost,
                muted: isHost,
                fallback: hostP || isHost ? avatar(hostName) : <span className="text-sm">Yayıncı bağlanıyor...</span>,
              };
            }

            if (!live) {
              return (
                <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-ink3 to-ink text-center">
                  <span className="text-5xl">📴</span>
                  <p className="font-display text-3xl text-white/80">Yayın Kapalı</p>
                  <p className="text-sm text-white/45">
                    {isHost ? "Yayını Başlat'a bas." : "Yayın başlayınca burada görünecek."}
                  </p>
                </div>
              );
            }

            const available = (["screen", "mod", "host"] as const).filter((k) => sources[k]);
            const defaultFocus = sources.screen ? "screen" : "host";
            const stored = (stream?.stageLayout ?? "screen") as "screen" | "mod" | "host";
            const focus = sources[stored] ? stored : defaultFocus;
            const popups = available.filter((k) => k !== focus);
            const main = sources[focus];

            return (
              <div
                ref={stageRef}
                className={`relative ${fsActive ? "bg-black" : ""} ${cssFs ? "fixed inset-0 z-[60] h-full w-full" : ""} ${
                  apiFs ? "h-screen w-screen" : ""
                }`}
              >
                <StageVideo
                  stream={main?.stream ?? null}
                  muted={main?.muted || listenOff}
                  mirror={main?.mirror}
                  fit={main?.fit ?? "cover"}
                  onClick={popupsHidden && popups.length > 0 ? () => setPopupsHidden(false) : undefined}
                  showVideo={main?.showVideo ?? false}
                  fallback={main?.fallback ?? <span className="text-sm">Yayıncı bağlanıyor...</span>}
                  onDoubleClick={isStaff && focus !== defaultFocus ? () => void setFocus(defaultFocus) : undefined}
                  className={fsActive ? "h-full w-full" : "aspect-video rounded-2xl"}
                >
                  <span className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold">
                    {main?.label}
                  </span>
                </StageVideo>

                {/* Tam ekran: sağ alt köşe */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFullscreen();
                  }}
                  title={fsActive ? "Normal ekrana dön" : "Tam ekran"}
                  aria-label={fsActive ? "Normal ekrana dön" : "Tam ekran"}
                  className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-black/60 text-white/90 hover:bg-black/80"
                >
                  {fsActive ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                    </svg>
                  )}
                </button>

                {/* Popup kameralar: yayıncı/diğerleri solda (16:9), moderatör SAĞ ÜSTTE KARE. Popup'a tek tık: gizle. */}
                {!popupsHidden &&
                  (["left", "right"] as const).map((side) => {
                    const list = popups.filter((k) => (side === "right" ? k === "mod" : k !== "mod"));
                    if (list.length === 0) return null;
                    return (
                      <div
                        key={side}
                        className={`absolute top-3 z-10 flex flex-col gap-2 ${side === "right" ? "right-3" : "left-3"}`}
                      >
                        {list.map((k) => {
                          const src = sources[k]!;
                          const square = k === "mod";
                          return (
                            <StageVideo
                              key={k}
                              stream={src.stream}
                              muted={src.muted || listenOff}
                              mirror={src.mirror}
                              fit={square ? "cover" : src.fit}
                              showVideo={src.showVideo}
                              fallback={src.fallback}
                              onClick={() => setPopupsHidden(true)}
                              className={`${
                                square ? "aspect-square w-24 sm:w-36" : "aspect-video w-32 sm:w-52"
                              } rounded-xl border-2 border-gold/60 shadow-xl shadow-black/60`}
                            >
                              <span className="pointer-events-none absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px]">
                                {src.label}
                              </span>
                              {isStaff && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void setFocus(k);
                                  }}
                                  title="Ana ekranla yer değiştir (herkes için)"
                                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-black/80"
                                >
                                  ⇄
                                </button>
                              )}
                            </StageVideo>
                          );
                        })}
                      </div>
                    );
                  })}

                {showPip && (
                  <SelfPip
                    stream={engine.localStream}
                    label={user.nickname}
                    camOn={camOn}
                    micOn={micOn}
                    mediaOff={engine.mediaKind === "off"}
                    onToggleCam={toggleCam}
                    onToggleMic={toggleMic}
                    onStart={toggleCam}
                  />
                )}
              </div>
            );
          })()}

          {/* Sahnedeki konuklar (yayıncı üzerinden herkese aktarılır) */}
          {stageOthers.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {stageOthers.map((p) => (
                <VideoTile
                  key={p.id}
                  muted={listenOff}
                  stream={engine.remoteStreams[p.userId] ?? null}
                  label={p.nickname}
                  role={p.role}
                  cameraOn={p.cameraOn}
                  micOn={p.micOn}
                  handRaised={p.handRaised}
                  accent="#a855f7"
                  state={engine.peerStates[p.userId] ?? (isHost ? undefined : engine.peerStates[hostP?.userId ?? -1])}
                />
              ))}
            </div>
          )}

          {me?.status === "waiting" && (
            <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              ⏳ Konuk isteğin bekleme listesinde. Onaylanınca sahneye alınacaksın.
            </div>
          )}

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

          {isStaff && liveOthers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {liveOthers.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-xs">
                  <span className={p.role === "guest" ? "text-fuchsia-300" : "text-white/70"}>
                    {p.role === "guest" ? "🎤" : p.role === "moderator" ? "🛡" : "👤"} {p.nickname}
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
            !isMod && (
              <button
                onClick={() => setGuestDialog(true)}
                disabled={me?.role === "guest" || me?.status === "waiting"}
                className="btn-gold rounded-xl px-5 py-2.5 text-sm font-bold"
              >
                🎤 Konuk Ol
              </button>
            )
          )}

          {canPublish && !showPip && (
            <>
              <button onClick={toggleMic} className={`btn-ghost rounded-xl px-4 py-2.5 text-sm ${micOn ? "text-white" : "text-red-300"}`}>
                {micOn ? "🎙 Mikrofon Açık" : "🔇 Mikrofon Kapalı"}
              </button>
              <button onClick={toggleCam} className={`btn-ghost rounded-xl px-4 py-2.5 text-sm ${camOn ? "text-white" : "text-red-300"}`}>
                {camOn ? "🎥 Kamera Açık" : "🚫 Kamera Kapalı"}
              </button>
            </>
          )}

          {isMod && (
            <button
              onClick={() => setListenPref(!listenOff)}
              title="Aynı odada yayıncı laptopu varsa dinlemeyi kapalı tut (çınlama/uğultu olmaz)"
              className={`btn-ghost rounded-xl px-4 py-2.5 text-sm ${listenOff ? "text-amber-300" : "text-emerald-300"}`}
            >
              {listenOff ? "🔈 Dinleme Kapalı" : "🔊 Dinleme Açık"}
            </button>
          )}

          {isHost && (
            <button
              onClick={() => void (engine.screenStream ? engine.stopScreen() : engine.startScreen())}
              className={`btn-ghost rounded-xl px-4 py-2.5 text-sm ${engine.screenStream ? "text-emerald-300" : ""}`}
            >
              {engine.screenStream ? "🎮 Ekran Paylaşımını Durdur" : "🎮 Oyun / Maç / Ekran Paylaş"}
            </button>
          )}

          {!isHost && (
            <button
              onClick={() => setHandRaised((h) => !h)}
              className={`btn-ghost rounded-xl px-4 py-2.5 text-sm ${handRaised ? "text-amber-300" : ""}`}
            >
              ✋ {handRaised ? "Eldayım" : "El Kaldır"}
            </button>
          )}

          {isHost && (
            <>
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

          {isStaff && (
            <Link href="/panel" className="ml-auto rounded-xl bg-white/5 px-4 py-2.5 text-sm hover:bg-white/15">
              🛡 {isHost ? "Admin" : "Moderatör"} Paneli
            </Link>
          )}
        </div>

        {/* RENAME DIALOG */}
        {renameOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="glass neon-ring w-full max-w-sm rounded-3xl p-6">
              <p className="font-display text-2xl text-gold">Rumuz</p>
              <p className="mt-2 text-sm text-white/60">
                Sohbette ve izleyici listesinde yalnızca rumuzun görünür. Ad soyadın ve e-postan gizli kalır.
              </p>
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={20}
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-gold/60"
              />
              {renameError && <p className="mt-2 text-sm text-red-300">{renameError}</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => void submitRename()} className="btn-gold flex-1 rounded-xl py-3 font-bold">
                  Kaydet
                </button>
                <button onClick={() => setRenameOpen(false)} className="btn-ghost rounded-xl px-5 py-3">
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GUEST DIALOG */}
        {guestDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="glass neon-ring w-full max-w-sm rounded-3xl p-6">
              <p className="font-display text-2xl text-gold">Konuk Ol</p>
              <p className="mt-2 text-sm text-white/60">
                Rumuzunla ({user.nickname}) konuk isteği gönderirsin. Onaylanınca sahneye alınırsın.
              </p>
              <label className="mt-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={guestCamOff}
                  onChange={(e) => setGuestCamOff(e.target.checked)}
                  className="h-4 w-4 accent-amber-400"
                />
                Yüzümü göstermek istemiyorum (kameram kapalı katıl)
              </label>
              <div className="mt-5 flex gap-2">
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

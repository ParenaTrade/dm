"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendBroadcast } from "@/lib/realtime-client";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:global.stun.twilio.com:3478" },
];

type PeerCtx = {
  remoteId: number;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswerPending: boolean;
  pendingCandidates: RTCIceCandidateInit[];
};

type Outgoing = { to: number | null; kind: string; body: string };

export type EngineState = {
  localStream: MediaStream | null;
  remoteStreams: Record<number, MediaStream>;
  peerStates: Record<number, RTCPeerConnectionState>;
  mediaKind: "off" | "camera";
  error: string | null;
};

let silentCtx: AudioContext | null = null;

function createSilentAudioTrack(): MediaStreamTrack {
  if (!silentCtx) {
    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    silentCtx = new Ctor();
  }
  const oscillator = silentCtx.createOscillator();
  const gain = silentCtx.createGain();
  const destination = silentCtx.createMediaStreamDestination();
  gain.gain.value = 0;
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start();
  return destination.stream.getAudioTracks()[0];
}

export function useLiveEngine(params: {
  streamId: number | null;
  userId: number | null;
  isHost: boolean;
  active: boolean;
  /** Supabase Realtime kanalı bağlıysa true: sinyaller websocket ile gider. */
  realtimeMode: boolean;
}) {
  const { streamId, userId, isHost, active, realtimeMode } = params;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const [peerStates, setPeerStates] = useState<Record<number, RTCPeerConnectionState>>({});
  const [mediaKind, setMediaKind] = useState<"off" | "camera">("off");
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [remoteScreens, setRemoteScreens] = useState<Record<number, MediaStream>>({});
  const [error, setError] = useState<string | null>(null);

  const peers = useRef(new Map<number, PeerCtx>());
  const outbox = useRef<Outgoing[]>([]);
  const cursor = useRef(0);
  const polling = useRef(false);
  const flushing = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const silentTrack = useRef<MediaStreamTrack | null>(null);
  const localScreenRef = useRef<MediaStream | null>(null);
  const screenSenders = useRef(new Map<number, RTCRtpSender[]>());
  const incoming = useRef(new Map<number, Map<string, MediaStream>>());
  const screenMeta = useRef(new Map<number, string | null>());
  const paramsRef = useRef({ streamId, userId, isHost, active, realtimeMode });
  paramsRef.current = { streamId, userId, isHost, active, realtimeMode };

  const queue = useCallback((item: Outgoing) => {
    outbox.current.push(item);
    if (outbox.current.length > 200) outbox.current.splice(0, outbox.current.length - 200);
  }, []);

  const flushOutbox = useCallback(async () => {
    if (flushing.current || !outbox.current.length) return;
    flushing.current = true;
    const batch = outbox.current.splice(0, 60);
    try {
      if (paramsRef.current.realtimeMode) {
        // Supabase Realtime broadcast: sunucuya dokunmadan anlık teslim
        for (const item of batch) {
          sendBroadcast({ type: "signal", from: paramsRef.current.userId ?? 0, ...item });
        }
      } else {
        await fetch("/api/stream/signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch }),
          keepalive: true,
        });
      }
    } catch {
      outbox.current.unshift(...batch);
    } finally {
      flushing.current = false;
    }
  }, []);

  const isScreenSender = (remoteId: number, sender: RTCRtpSender) =>
    (screenSenders.current.get(remoteId) ?? []).includes(sender);

  const attachLocalTracks = useCallback((ctx: PeerCtx) => {
    const stream = localStreamRef.current;
    const kinds = new Set<string>();
    if (stream) {
      for (const track of stream.getTracks()) {
        kinds.add(track.kind);
        const sender = ctx.pc
          .getSenders()
          .find((s) => s.track?.kind === track.kind && !isScreenSender(ctx.remoteId, s));
        if (sender) {
          sender.replaceTrack(track).catch(() => undefined);
        } else {
          ctx.pc.addTrack(track, stream);
        }
      }
    }
    // SDP boş kalmasın diye sessiz ses kanalı ekle
    if (!kinds.has("audio")) {
      if (!silentTrack.current) silentTrack.current = createSilentAudioTrack();
      const track = silentTrack.current;
      const sender = ctx.pc.getSenders().find((s) => s.track?.kind === "audio" && !isScreenSender(ctx.remoteId, s));
      if (sender && track) sender.replaceTrack(track).catch(() => undefined);
      else if (track) ctx.pc.addTrack(track, stream ?? new MediaStream([track]));
    }
  }, []);

  /** Yayıncı: ekran/oyun akışını (ayrı video) bu bağlantıya ekle veya kaldır. */
  const attachScreen = useCallback(
    (ctx: PeerCtx) => {
      const screen = localScreenRef.current;
      const old = screenSenders.current.get(ctx.remoteId) ?? [];
      if (!screen) {
        for (const sender of old) {
          try {
            ctx.pc.removeTrack(sender);
          } catch {
            /* noop */
          }
        }
        screenSenders.current.delete(ctx.remoteId);
      } else if (!old.length) {
        const senders = screen.getTracks().map((track) => ctx.pc.addTrack(track, screen));
        screenSenders.current.set(ctx.remoteId, senders);
      }
      queue({ to: ctx.remoteId, kind: "meta", body: JSON.stringify({ screenId: screen?.id ?? null }) });
    },
    [queue],
  );

  /** İzleyici: gelen akışları kamera ve ekran olarak ayır (meta sinyaline göre). */
  const publishRemote = useCallback((remoteId: number) => {
    const map = incoming.current.get(remoteId);
    if (!map) return;
    const screenId = screenMeta.current.get(remoteId);
    const streams = Array.from(map.values());
    let camera: MediaStream | undefined;
    let screen: MediaStream | undefined;
    if (typeof screenId === "string") {
      screen = map.get(screenId);
      camera = streams.find((st) => st.id !== screenId);
    } else {
      camera = streams[0];
      if (screenId === null && streams.length > 1 && camera) {
        map.clear();
        map.set(camera.id, camera);
      }
    }
    if (camera) setRemoteStreams((prev) => (prev[remoteId] === camera ? prev : { ...prev, [remoteId]: camera }));
    setRemoteScreens((prev) => {
      if (screen) return prev[remoteId] === screen ? prev : { ...prev, [remoteId]: screen };
      if (!(remoteId in prev)) return prev;
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
  }, []);

  const ensurePeer = useCallback(
    (remoteId: number, polite: boolean): PeerCtx => {
      const existing = peers.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: "max-bundle" });
      const ctx: PeerCtx = {
        remoteId,
        pc,
        polite,
        makingOffer: false,
        ignoreOffer: false,
        settingRemoteAnswerPending: false,
        pendingCandidates: [],
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          queue({ to: remoteId, kind: "candidate", body: JSON.stringify(event.candidate.toJSON()) });
        }
      };

      pc.onnegotiationneeded = async () => {
        try {
          ctx.makingOffer = true;
          await pc.setLocalDescription();
          const desc = pc.localDescription;
          if (desc) queue({ to: remoteId, kind: desc.type, body: JSON.stringify(desc.toJSON()) });
        } catch (err) {
          console.warn("negotiation failed", err);
        } finally {
          ctx.makingOffer = false;
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        let map = incoming.current.get(remoteId);
        if (!map) {
          map = new Map();
          incoming.current.set(remoteId, map);
        }
        if (!map.has(stream.id)) map.set(stream.id, stream);
        publishRemote(remoteId);
      };

      pc.onconnectionstatechange = () => {
        setPeerStates((prev) => ({ ...prev, [remoteId]: pc.connectionState }));
        if (pc.connectionState === "failed") {
          const withRestart = pc as RTCPeerConnection & { restartIce?: () => void };
          withRestart.restartIce?.();
        }
      };

      peers.current.set(remoteId, ctx);
      attachLocalTracks(ctx);
      if (localScreenRef.current) attachScreen(ctx);
      return ctx;
    },
    [attachLocalTracks, attachScreen, publishRemote, queue],
  );

  const closePeer = useCallback((remoteId: number) => {
    const ctx = peers.current.get(remoteId);
    if (!ctx) return;
    ctx.pc.onicecandidate = null;
    ctx.pc.ontrack = null;
    ctx.pc.onnegotiationneeded = null;
    try {
      ctx.pc.close();
    } catch {
      /* noop */
    }
    peers.current.delete(remoteId);
    incoming.current.delete(remoteId);
    screenMeta.current.delete(remoteId);
    screenSenders.current.delete(remoteId);
    setRemoteScreens((prev) => {
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
    setPeerStates((prev) => {
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
  }, []);

  const handleDescription = useCallback(async (ctx: PeerCtx, description: RTCSessionDescriptionInit) => {
    const pc = ctx.pc;
    const readyForOffer = !ctx.makingOffer && (pc.signalingState === "stable" || ctx.settingRemoteAnswerPending);
    const offerCollision = description.type === "offer" && !readyForOffer;
    ctx.ignoreOffer = !ctx.polite && offerCollision;
    if (ctx.ignoreOffer) return;

    try {
      ctx.settingRemoteAnswerPending = description.type === "answer";
      await pc.setRemoteDescription(description);
      ctx.settingRemoteAnswerPending = false;

      const pending = ctx.pendingCandidates.splice(0);
      for (const candidate of pending) {
        await pc.addIceCandidate(candidate).catch(() => undefined);
      }

      if (description.type === "offer") {
        await pc.setLocalDescription();
        const desc = pc.localDescription;
        if (desc) queue({ to: ctx.remoteId, kind: desc.type, body: JSON.stringify(desc.toJSON()) });
      }
    } catch (err) {
      console.warn("description error", err);
    }
  }, [queue]);

  const handleCandidate = useCallback(async (ctx: PeerCtx, candidate: RTCIceCandidateInit) => {
    const pc = ctx.pc;
    if (!pc.remoteDescription || pc.signalingState === "have-local-offer") {
      ctx.pendingCandidates.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      ctx.pendingCandidates.push(candidate);
    }
  }, []);

  /** Yayıncı: canlı katılımcılarla bağlantı kur / kopanları kapat. */
  const syncParticipants = useCallback(
    (list: { userId: number; status: string }[]) => {
      const me = paramsRef.current.userId;
      if (!me) return;
      for (const p of list) {
        if (p.userId === me) continue;
        if (p.status === "live" && paramsRef.current.isHost) {
          ensurePeer(p.userId, false);
        }
      }
      for (const key of Array.from(peers.current.keys())) {
        const match = list.find((p) => p.userId === key);
        if (!match || match.status !== "live") closePeer(key);
      }
    },
    [closePeer, ensurePeer],
  );

  /** Hem Realtime broadcast hem REST kuyruğu için tek sinyal işleyici. */
  const processSignal = useCallback(
    async (from: number, kind: string, body: string) => {
      if (from === paramsRef.current.userId) return;
      if (kind === "bye") {
        closePeer(from);
        return;
      }
      if (!body) return;
      if (kind === "meta") {
        try {
          const meta = JSON.parse(body) as { screenId?: string | null };
          screenMeta.current.set(from, meta.screenId ?? null);
          publishRemote(from);
        } catch {
          /* noop */
        }
        return;
      }
      try {
        const ctx = ensurePeer(from, !paramsRef.current.isHost);
        const payload = JSON.parse(body);
        if (kind === "candidate") await handleCandidate(ctx, payload);
        else await handleDescription(ctx, payload);
      } catch {
        /* bozuk sinyali yut */
      }
    },
    [closePeer, ensurePeer, handleCandidate, handleDescription, publishRemote],
  );

  const pollSignals = useCallback(async () => {
    if (polling.current || paramsRef.current.realtimeMode) return;
    polling.current = true;
    try {
      const res = await fetch(`/api/stream/signals?since=${cursor.current}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        cursor?: number;
        signals?: { id: number; from: number; kind: string; body: string }[];
      };
      cursor.current = data.cursor ?? cursor.current;
      for (const signal of data.signals ?? []) {
        await processSignal(signal.from, signal.kind, signal.body);
      }
    } catch {
      /* ağ hatası: sonraki turda tekrar dene */
    } finally {
      polling.current = false;
    }
  }, [processSignal]);

  const setMedia = useCallback(
    async (kind: "off" | "camera", opts?: { muted?: boolean; videoOff?: boolean }) => {
      setError(null);
      try {
        if (kind === "off") {
          localStreamRef.current?.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
          setLocalStream(null);
          setMediaKind("off");
          for (const [, ctx] of peers.current) attachLocalTracks(ctx);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (opts?.muted) stream.getAudioTracks().forEach((t) => (t.enabled = false));
        if (opts?.videoOff) stream.getVideoTracks().forEach((t) => (t.enabled = false));

        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMediaKind("camera");
        for (const [, ctx] of peers.current) attachLocalTracks(ctx);
      } catch (err) {
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Kamera/mikrofon izni verilmedi. Tarayıcı izinlerini kontrol et."
            : "Medya başlatılamadı. Cihazını kontrol et.",
        );
      }
    },
    [attachLocalTracks],
  );

  const stopScreen = useCallback(() => {
    localScreenRef.current?.getTracks().forEach((track) => track.stop());
    localScreenRef.current = null;
    setLocalScreen(null);
    for (const [, ctx] of peers.current) attachScreen(ctx);
  }, [attachScreen]);

  /** Yayıncı: oyun / maç / ekran paylaşımı; kameradan bağımsız ikinci video olarak gider. */
  const startScreen = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: true });
      localScreenRef.current?.getTracks().forEach((track) => track.stop());
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopScreen());
      localScreenRef.current = stream;
      setLocalScreen(stream);
      for (const [, ctx] of peers.current) attachScreen(ctx);
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Ekran paylaşımı izni verilmedi."
          : "Ekran paylaşımı başlatılamadı.",
      );
    }
  }, [attachScreen, stopScreen]);

  const toggleAudio = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setLocalStream(localStreamRef.current);
    return !track.enabled;
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setLocalStream(localStreamRef.current);
    return !track.enabled;
  }, []);

  useEffect(() => {
    if (!active || !streamId) return;
    const signalTimer = setInterval(() => void pollSignals(), 900);
    const flushTimer = setInterval(() => void flushOutbox(), 320);
    return () => {
      clearInterval(signalTimer);
      clearInterval(flushTimer);
    };
  }, [active, streamId, pollSignals, flushOutbox]);

  useEffect(() => {
    return () => {
      for (const [, ctx] of peers.current) {
        try {
          ctx.pc.close();
        } catch {
          /* noop */
        }
      }
      peers.current.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localScreenRef.current?.getTracks().forEach((track) => track.stop());
      silentTrack.current?.stop();
      silentTrack.current = null;
    };
  }, []);

  return {
    localStream,
    remoteStreams,
    peerStates,
    mediaKind,
    screenStream: localScreen,
    remoteScreens,
    error,
    setMedia,
    startScreen,
    stopScreen,
    toggleAudio,
    toggleVideo,
    syncParticipants,
    processSignal,
    clearError: () => setError(null),
  };
}

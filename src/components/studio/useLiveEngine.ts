"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendBroadcast } from "@/lib/realtime-client";
import { MIC_CONSTRAINTS, cleanMicStream } from "@/lib/audio-cleanup";

/**
 * STUN tek başına yetmez: telefon operatörü / kurumsal ağ / simetrik NAT arkasındaki kullanıcı bağlanamaz
 * ("bağlanmıyor", "gidip geliyor"). Bu yüzden TURN röle sunucusu tanımlanabilir:
 *   NEXT_PUBLIC_TURN_URLS="turn:sunucu:3478,turns:sunucu:5349?transport=tcp"
 *   NEXT_PUBLIC_TURN_USERNAME / NEXT_PUBLIC_TURN_CREDENTIAL
 */
const BASE_ICE_SERVERS: RTCIceServer[] = (() => {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: "stun:global.stun.twilio.com:3478" },
  ];
  const urls = (process.env.NEXT_PUBLIC_TURN_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.length) {
    servers.push({
      urls,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? "",
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? "",
    });
  }
  return servers;
})();

/** Sunucudan (Cloudflare TURN) alınan kısa ömürlü TURN bilgisi; tüm bağlantılar bunu kullanır. */
let turnServers: RTCIceServer[] = [];
let turnLoadedAt = 0;
async function loadTurnServers(): Promise<boolean> {
  if (turnServers.length && Date.now() - turnLoadedAt < 6 * 3600_000) return false;
  try {
    const res = await fetch("/api/turn", { cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean; iceServers?: RTCIceServer[] };
    if (data.ok && data.iceServers?.length) {
      turnServers = data.iceServers;
      turnLoadedAt = Date.now();
      return true;
    }
  } catch {
    /* STUN ile devam */
  }
  return false;
}
const currentIceServers = (): RTCIceServer[] => [...BASE_ICE_SERVERS, ...turnServers];

/** Gönderim kalitesi sınırları: yayıncının yükleme hızını aşmasın (donma/kopmanın ana sebebi). */
const CAM_MAX_BITRATE = 1_000_000;
const RELAY_MAX_BITRATE = 700_000;
const SCREEN_MAX_BITRATE = 2_200_000;

type PeerCtx = {
  remoteId: number;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswerPending: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  /** Bu bağlantıdan giden kamera+mikrofon için TEK sabit akış kimliği (ses ve video aynı akışta gelsin). */
  camOut: MediaStream;
  audioSender: RTCRtpSender | null;
  videoSender: RTCRtpSender | null;
  createdAt: number;
  disconnectedAt: number | null;
  helloBody: string;
  lastHelloAt: number;
  restartTimer: ReturnType<typeof setTimeout> | null;
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
  const micCleanup = useRef<(() => void) | null>(null);
  const screenCleanup = useRef<(() => void) | null>(null);
  const localScreenRef = useRef<MediaStream | null>(null);
  const screenSenders = useRef(new Map<number, RTCRtpSender[]>());
  const incoming = useRef(new Map<number, Map<string, MediaStream>>());
  const screenMeta = useRef(
    new Map<number, { screenId: string | null; relays: Record<string, number>; screenRelays: Record<string, number> }>(),
  );
  const screenStreams = useRef<Record<number, MediaStream>>({});
  const relayedScreenUsers = useRef(new Map<number, Set<number>>());
  const screenRelaySenders = useRef(new Map<string, RTCRtpSender[]>());
  const sid = useRef(Math.random().toString(36).slice(2) + Date.now().toString(36));
  const helloSeq = useRef(0);
  const remoteSid = useRef(new Map<number, string>());
  const greeted = useRef<number | null>(null);
  const lastGreetAt = useRef(0);
  const camStreams = useRef<Record<number, MediaStream>>({});
  const relayedUsers = useRef(new Map<number, Set<number>>());
  const relaySources = useRef<Set<number>>(new Set());
  const relaySenders = useRef(new Map<string, RTCRtpSender[]>());
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
        const res = await fetch("/api/stream/signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch }),
          keepalive: true,
        });
        if (!res.ok) throw new Error(`signal http ${res.status}`);
      }
    } catch {
      outbox.current.unshift(...batch);
    } finally {
      flushing.current = false;
    }
  }, []);

  /** Video gönderim hızını sınırla (bağlantı kalitesine göre otomatik çözünürlük düşürmeye izin ver). */
  const applyQuality = useCallback((ctx: PeerCtx) => {
    const screenSet = new Set(screenSenders.current.get(ctx.remoteId) ?? []);
    for (const sender of ctx.pc.getSenders()) {
      if (sender.track?.kind !== "video") continue;
      const max = sender === ctx.videoSender ? CAM_MAX_BITRATE : screenSet.has(sender) ? SCREEN_MAX_BITRATE : RELAY_MAX_BITRATE;
      try {
        const params = sender.getParameters();
        if (!params.encodings || !params.encodings.length) params.encodings = [{}];
        const enc = params.encodings[0];
        if (enc.maxBitrate === max) continue;
        enc.maxBitrate = max;
        enc.maxFramerate = sender === ctx.videoSender ? 30 : 30;
        (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference =
          "maintain-framerate";
        void sender.setParameters(params).catch(() => undefined);
      } catch {
        /* henüz müzakere edilmedi: bağlanınca tekrar denenecek */
      }
    }
  }, []);

  /**
   * Kamera + mikrofonu bu bağlantıya bağlar.
   * - Ses ve video HER ZAMAN aynı sabit akışla (ctx.camOut) gider; böylece karşı taraf tek bir akış görür.
   *   (Eski kod: izleyici iken sessiz ses ayrı akışla gidiyordu, konuk kamerayı sonradan açınca
   *   ses ve görüntü iki ayrı akışa bölünüyor, yayıncı/diğerleri görüntüyü hiç göstermiyordu.)
   * - Gönderici (sender) referansları saklanır; ekran/aktarım göndericileriyle karışmaz.
   */
  const attachLocalTracks = useCallback((ctx: PeerCtx) => {
    const local = localStreamRef.current;
    const video = local?.getVideoTracks()[0] ?? null;
    let audio: MediaStreamTrack | null = local?.getAudioTracks()[0] ?? null;

    // SDP boş kalmasın diye mikrofon yokken sessiz ses kanalı kullan
    if (!audio) {
      if (!silentTrack.current || silentTrack.current.readyState === "ended") {
        silentTrack.current = createSilentAudioTrack();
      }
      audio = silentTrack.current;
    }

    if (audio) {
      if (ctx.audioSender) ctx.audioSender.replaceTrack(audio).catch(() => undefined);
      else ctx.audioSender = ctx.pc.addTrack(audio, ctx.camOut);
    }

    if (video) {
      if (ctx.videoSender) ctx.videoSender.replaceTrack(video).catch(() => undefined);
      else ctx.videoSender = ctx.pc.addTrack(video, ctx.camOut);
    } else if (ctx.videoSender) {
      ctx.videoSender.replaceTrack(null).catch(() => undefined);
    }
  }, []);

  /** Yayıncı: bu bağlantıya ekran akışı + aktarılan moderatör/konuk kameraları hakkında bilgi gönder. */
  const sendMeta = useCallback(
    (to: number) => {
      const relays: Record<string, number> = {};
      for (const [key] of relaySenders.current) {
        const [toS, fromS] = key.split(":");
        if (Number(toS) !== to) continue;
        const stream = camStreams.current[Number(fromS)];
        if (stream) relays[stream.id] = Number(fromS);
      }
      const screenRelays: Record<string, number> = {};
      for (const [key] of screenRelaySenders.current) {
        const [toS, fromS] = key.split(":");
        if (Number(toS) !== to) continue;
        const stream = screenStreams.current[Number(fromS)];
        if (stream) screenRelays[stream.id] = Number(fromS);
      }
      queue({
        to,
        kind: "meta",
        body: JSON.stringify({ screenId: localScreenRef.current?.id ?? null, relays, screenRelays }),
      });
    },
    [queue],
  );

  /** Yayıncı merkezli aktarım: moderatör/konuk kameralarını diğer herkese ilet. */
  const syncRelays = useCallback(() => {
    if (!paramsRef.current.isHost) return;
    const wanted = relaySources.current;
    let changed = false;
    for (const [key, senders] of Array.from(relaySenders.current)) {
      const [toS, fromS] = key.split(":");
      const toCtx = peers.current.get(Number(toS));
      if (!toCtx || !wanted.has(Number(fromS)) || !camStreams.current[Number(fromS)]) {
        if (toCtx) {
          for (const sender of senders) {
            try {
              toCtx.pc.removeTrack(sender);
            } catch {
              /* noop */
            }
          }
        }
        relaySenders.current.delete(key);
        changed = true;
      }
    }
    for (const from of wanted) {
      const source = camStreams.current[from];
      if (!source) continue;
      const tracks = source.getTracks();
      for (const [to, ctx] of peers.current) {
        if (to === from) continue;
        const key = `${to}:${from}`;
        const existing = relaySenders.current.get(key);
        if (existing && existing.length === tracks.length) continue;
        existing?.forEach((sender) => {
          try {
            ctx.pc.removeTrack(sender);
          } catch {
            /* noop */
          }
        });
        relaySenders.current.set(
          key,
          tracks.map((track) => ctx.pc.addTrack(track, source)),
        );
        changed = true;
      }
    }

    // Moderatör ekran paylaşımını da herkese aktar
    for (const [key, senders] of Array.from(screenRelaySenders.current)) {
      const [toS, fromS] = key.split(":");
      const toCtx = peers.current.get(Number(toS));
      if (!toCtx || !wanted.has(Number(fromS)) || !screenStreams.current[Number(fromS)]) {
        if (toCtx) {
          for (const sender of senders) {
            try {
              toCtx.pc.removeTrack(sender);
            } catch {
              /* noop */
            }
          }
        }
        screenRelaySenders.current.delete(key);
        changed = true;
      }
    }
    for (const from of wanted) {
      const source = screenStreams.current[from];
      if (!source) continue;
      const tracks = source.getTracks();
      for (const [to, ctx] of peers.current) {
        if (to === from) continue;
        const key = `${to}:${from}`;
        const existing = screenRelaySenders.current.get(key);
        if (existing && existing.length === tracks.length) continue;
        existing?.forEach((sender) => {
          try {
            ctx.pc.removeTrack(sender);
          } catch {
            /* noop */
          }
        });
        screenRelaySenders.current.set(
          key,
          tracks.map((track) => ctx.pc.addTrack(track, source)),
        );
        changed = true;
      }
    }
    if (changed) for (const [to] of peers.current) sendMeta(to);
  }, [sendMeta]);

  /** Yayıncı: ekran/oyun akışını bu bağlantıya ekle veya kaldır. */
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
      sendMeta(ctx.remoteId);
    },
    [sendMeta],
  );

  /** Gelen akışları ayır: yayıncı kamerası, ekran paylaşımı ve aktarılan moderatör/konuk kameraları. */
  const publishRemote = useCallback((remoteId: number) => {
    const map = incoming.current.get(remoteId);
    if (!map) return;
    const meta = screenMeta.current.get(remoteId);
    const screenId = meta?.screenId ?? null;
    const relays = meta?.relays ?? {};
    const screenRelays = meta?.screenRelays ?? {};
    const streams = Array.from(map.values());

    const camera = streams.find(
      (st) => st.id !== screenId && relays[st.id] === undefined && screenRelays[st.id] === undefined,
    );
    const screen = screenId ? map.get(screenId) : undefined;
    if (screen) screenStreams.current[remoteId] = screen;
    else delete screenStreams.current[remoteId];

    const relayedScreensNow = new Map<number, MediaStream>();
    for (const [streamId, userId] of Object.entries(screenRelays)) {
      const stream = map.get(streamId);
      if (stream) relayedScreensNow.set(userId, stream);
    }
    const prevScreens = relayedScreenUsers.current.get(remoteId) ?? new Set<number>();
    relayedScreenUsers.current.set(remoteId, new Set(relayedScreensNow.keys()));

    const relayedNow = new Map<number, MediaStream>();
    for (const [streamId, userId] of Object.entries(relays)) {
      const stream = map.get(streamId);
      if (stream) relayedNow.set(userId, stream);
    }
    const prevRelayed = relayedUsers.current.get(remoteId) ?? new Set<number>();
    relayedUsers.current.set(remoteId, new Set(relayedNow.keys()));

    if (camera) camStreams.current[remoteId] = camera;

    setRemoteStreams((prev) => {
      const next = { ...prev };
      if (camera) next[remoteId] = camera;
      for (const uid of prevRelayed) if (!relayedNow.has(uid)) delete next[uid];
      for (const [uid, stream] of relayedNow) next[uid] = stream;
      return next;
    });
    setRemoteScreens((prev) => {
      const next = { ...prev };
      let changed = false;
      if (screen) {
        if (next[remoteId] !== screen) {
          next[remoteId] = screen;
          changed = true;
        }
      } else if (remoteId in next) {
        delete next[remoteId];
        changed = true;
      }
      for (const uid of prevScreens) {
        if (!relayedScreensNow.has(uid) && uid in next) {
          delete next[uid];
          changed = true;
        }
      }
      for (const [uid, stream] of relayedScreensNow) {
        if (next[uid] !== stream) {
          next[uid] = stream;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    if (paramsRef.current.isHost) syncRelays();
  }, [syncRelays]);

  const ensurePeer = useCallback(
    (remoteId: number, polite: boolean): PeerCtx => {
      const existing = peers.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: currentIceServers(), bundlePolicy: "max-bundle", iceCandidatePoolSize: 4 });
      const ctx: PeerCtx = {
        remoteId,
        pc,
        polite,
        makingOffer: false,
        ignoreOffer: false,
        settingRemoteAnswerPending: false,
        pendingCandidates: [],
        camOut: new MediaStream(),
        audioSender: null,
        videoSender: null,
        createdAt: Date.now(),
        disconnectedAt: null,
        helloBody: "",
        lastHelloAt: 0,
        restartTimer: null,
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
        ctx.disconnectedAt = pc.connectionState === "disconnected" ? (ctx.disconnectedAt ?? Date.now()) : null;
        const withRestart = pc as RTCPeerConnection & { restartIce?: () => void };
        if (ctx.restartTimer) {
          clearTimeout(ctx.restartTimer);
          ctx.restartTimer = null;
        }
        if (pc.connectionState === "failed") {
          withRestart.restartIce?.();
        } else if (pc.connectionState === "disconnected") {
          // Kısa kopmalarda 2.5 sn içinde kendiliğinden toparlanmazsa ICE'ı yenile (görüntü takılmasını bitirir)
          ctx.restartTimer = setTimeout(() => {
            if (pc.connectionState === "disconnected") withRestart.restartIce?.();
          }, 2500);
        } else if (pc.connectionState === "connected") {
          applyQuality(ctx);
        }
      };
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          (pc as RTCPeerConnection & { restartIce?: () => void }).restartIce?.();
        }
      };

      peers.current.set(remoteId, ctx);
      // Yayıncı her yeni bağlantıda BENZERSİZ bir hello kimliği yollar: karşı taraf eski (bayat)
      // bağlantısını bırakıp temiz başlar. (Konuk bekleme→sahne geçişinde eski bağlantı takılı kalıyordu.)
      const helloBody = paramsRef.current.isHost ? `${sid.current}.${++helloSeq.current}` : sid.current;
      ctx.helloBody = helloBody;
      ctx.lastHelloAt = Date.now();
      queue({ to: remoteId, kind: "hello", body: helloBody });
      attachLocalTracks(ctx);
      if (localScreenRef.current) attachScreen(ctx);
      if (paramsRef.current.isHost) syncRelays();
      applyQuality(ctx);
      return ctx;
    },
    [applyQuality, attachLocalTracks, attachScreen, publishRemote, queue, syncRelays],
  );

  const closePeer = useCallback((remoteId: number, notify = false) => {
    const ctx = peers.current.get(remoteId);
    if (!ctx) return;
    if (notify) queue({ to: remoteId, kind: "bye", body: "" });
    if (ctx.restartTimer) clearTimeout(ctx.restartTimer);
    ctx.pc.onicecandidate = null;
    ctx.pc.ontrack = null;
    ctx.pc.onnegotiationneeded = null;
    ctx.pc.onconnectionstatechange = null;
    ctx.pc.oniceconnectionstatechange = null;
    try {
      ctx.pc.close();
    } catch {
      /* noop */
    }
    peers.current.delete(remoteId);
    incoming.current.delete(remoteId);
    screenMeta.current.delete(remoteId);
    screenSenders.current.delete(remoteId);
    delete camStreams.current[remoteId];
    delete screenStreams.current[remoteId];
    for (const [key, senders] of Array.from(screenRelaySenders.current)) {
      const [toS, fromS] = key.split(":");
      if (Number(toS) !== remoteId && Number(fromS) !== remoteId) continue;
      screenRelaySenders.current.delete(key);
      const toCtx = peers.current.get(Number(toS));
      if (toCtx && Number(toS) !== remoteId) {
        for (const sender of senders) {
          try {
            toCtx.pc.removeTrack(sender);
          } catch {
            /* noop */
          }
        }
        sendMeta(Number(toS));
      }
    }
    relayedScreenUsers.current.delete(remoteId);
    for (const [key, senders] of Array.from(relaySenders.current)) {
      const [toS, fromS] = key.split(":");
      if (Number(toS) !== remoteId && Number(fromS) !== remoteId) continue;
      relaySenders.current.delete(key);
      const toCtx = peers.current.get(Number(toS));
      if (toCtx && Number(toS) !== remoteId) {
        // Ayrılan kaynağın aktarımını diğer katılımcılardan kaldır.
        for (const sender of senders) {
          try {
            toCtx.pc.removeTrack(sender);
          } catch {
            /* noop */
          }
        }
        sendMeta(Number(toS));
      }
    }
    const relayed = relayedUsers.current.get(remoteId);
    relayedUsers.current.delete(remoteId);
    if (relayed?.size) {
      setRemoteStreams((prev) => {
        const next = { ...prev };
        for (const uid of relayed) delete next[uid];
        return next;
      });
    }
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
  }, [queue, sendMeta]);

  const handleDescription = useCallback(async (ctx: PeerCtx, description: RTCSessionDescriptionInit) => {
    const pc = ctx.pc;
    // Bekleyen teklifimiz yokken gelen "answer" bayat/yinelenmiş sinyaldir (stable durumda uygulanamaz): yok say.
    if (description.type === "answer" && pc.signalingState === "stable") return;
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

  /** Yayıncı: canlı katılımcılarla bağlantı kur / kopanları kapat; takılı kalan bağlantıları yenile. */
  const syncParticipants = useCallback(
    (list: { userId: number; status: string; role?: string }[]) => {
      const me = paramsRef.current.userId;
      if (!me) return;
      const isHost = paramsRef.current.isHost;
      // "waiting" (konuk isteği bekleyen) kişi hâlâ yayını izliyor: bağlantısı KAPANMAMALI.
      // (Eskiden kapanıyordu; onaylanınca konuk eski/ölü bağlantıda kalıyor, yayıncıyı göremiyordu.)
      const connectable = (status: string) => status === "live" || status === "waiting";
      const now = Date.now();

      // 1) Ölü / takılı bağlantıları temizle (yeniden kurulacak)
      for (const [key, ctx] of Array.from(peers.current)) {
        const match = list.find((p) => p.userId === key);
        if (!match || !connectable(match.status)) continue;
        const st = ctx.pc.connectionState;
        const isStage = match.role === "guest" || match.role === "moderator";
        // Kaybolmuş "hello" yüzünden karşı taraf sinyalleri yok sayıyor olabilir: bağlanana kadar tekrar gönder
        if (st !== "connected" && now - ctx.lastHelloAt > 4000 && ctx.helloBody) {
          ctx.lastHelloAt = now;
          queue({ to: key, kind: "hello", body: ctx.helloBody });
        }
        const dead =
          st === "failed" ||
          st === "closed" ||
          (st === "disconnected" && ctx.disconnectedAt !== null && now - ctx.disconnectedAt > 8000) ||
          // Hiç bağlanamayan her bağlantı (izleyici dahil) 20 sn sonra yeniden kurulur
          (st !== "connected" && now - ctx.createdAt > (isStage ? 20000 : 25000));
        if (!dead) continue;
        closePeer(key, isHost);
        if (!isHost) {
          remoteSid.current.delete(key);
          if (greeted.current === key) greeted.current = null;
        }
      }

      // 2) Yeni bağlantılar
      for (const p of list) {
        if (p.userId === me) continue;
        if (isHost && connectable(p.status)) ensurePeer(p.userId, false);
      }
      if (!isHost) {
        // İzleyici/mod/konuk: yayıncıya "buradayım" de; yenileme sonrası eski bağlantı temizlenir.
        const hostP = list.find((p) => p.role === "host" && p.status === "live");
        if (hostP && greeted.current !== hostP.userId) {
          greeted.current = hostP.userId;
          lastGreetAt.current = now;
          queue({ to: hostP.userId, kind: "hello", body: sid.current });
        } else if (hostP && now - lastGreetAt.current > 5000 && peers.current.get(hostP.userId)?.pc.connectionState !== "connected") {
          // Yayıncıya bağlanana kadar hello'yu tekrarla (ilk hello kaybolduysa bağlantı hiç kurulmuyordu)
          lastGreetAt.current = now;
          queue({ to: hostP.userId, kind: "hello", body: sid.current });
        } else if (!hostP) {
          greeted.current = null;
        }
      }

      // 3) Gerçekten ayrılan / çıkarılan kişilerin bağlantısını kapat
      for (const key of Array.from(peers.current.keys())) {
        const match = list.find((p) => p.userId === key);
        if (!match || !connectable(match.status)) closePeer(key);
      }
    },
    [closePeer, ensurePeer, queue],
  );

  /** Yayıncı: hangi katılımcıların kamerası herkese aktarılsın (canlı moderatör/konuklar). */
  const setRelaySources = useCallback(
    (ids: number[]) => {
      const next = new Set(ids);
      const same = next.size === relaySources.current.size && ids.every((id) => relaySources.current.has(id));
      if (same) return;
      relaySources.current = next;
      syncRelays();
    },
    [syncRelays],
  );

  /** Hem Realtime broadcast hem REST kuyruğu için tek sinyal işleyici. */
  const processSignal = useCallback(
    async (from: number, kind: string, body: string) => {
      if (from === paramsRef.current.userId) return;
      if (kind === "bye") {
        closePeer(from);
        // Yeni bir "hello" gelene kadar bu göndericinin eski sinyallerini yok say; yeniden selamlaş.
        remoteSid.current.delete(from);
        if (greeted.current === from) greeted.current = null;
        return;
      }
      if (!body) return;
      if (kind === "hello") {
        const prev = remoteSid.current.get(from);
        remoteSid.current.set(from, body);
        // Karşı taraf yenilenmişse (yeni oturum kimliği) eski bağlantıyı bırak; yenisi kurulacak.
        if (prev && prev !== body) closePeer(from);
        return;
      }
      // Hello almadığımız göndericinin sinyali bayat olabilir (eski oturum): yok say.
      if (!remoteSid.current.has(from)) return;
      if (kind === "meta") {
        try {
          const meta = JSON.parse(body) as {
            screenId?: string | null;
            relays?: Record<string, number>;
            screenRelays?: Record<string, number>;
          };
          screenMeta.current.set(from, {
            screenId: meta.screenId ?? null,
            relays: meta.relays ?? {},
            screenRelays: meta.screenRelays ?? {},
          });
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

  /**
   * Kamera + mikrofonu başlatır. Başarılıysa true döner.
   * Kamera yok / başka uygulama kullanıyorsa yalnız mikrofonla devam eder (eskiden her şey iptal oluyordu,
   * konukta ne kamera ne mikrofon düğmesi çalışıyordu).
   */
  const setMedia = useCallback(
    async (
      kind: "off" | "camera",
      opts?: { muted?: boolean; videoOff?: boolean; audioOff?: boolean },
    ): Promise<boolean> => {
      setError(null);
      try {
        // Kamera da mikrofon da istenmiyorsa hiçbir cihaz açılmaz (varsayılan: ikisi de kapalı)
        if (kind === "camera" && opts?.videoOff && opts?.audioOff) kind = "off";
        if (kind === "off") {
          micCleanup.current?.();
          micCleanup.current = null;
          localStreamRef.current?.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
          setLocalStream(null);
          setMediaKind("off");
          for (const [, ctx] of peers.current) attachLocalTracks(ctx);
          return true;
        }

        const videoC: MediaTrackConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        };
        const gum = (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c);
        // videoOff / audioOff: o cihaz hiç açılmaz (tarayıcıda kamera/mikrofon göstergesi yanmaz)
        const vC: MediaTrackConstraints | false = opts?.videoOff ? false : videoC;
        const aC: MediaTrackConstraints | false = opts?.audioOff ? false : MIC_CONSTRAINTS;
        let raw: MediaStream;
        let warn: string | null = null;
        try {
          raw = await gum({ video: vC, audio: aC });
        } catch (err) {
          const name = err instanceof Error ? err.name : "";
          if (name === "NotAllowedError" || name === "SecurityError") throw err;
          try {
            raw = await gum({ video: vC, audio: aC ? true : false }); // kısıt reddedildiyse sade ayarla dene
          } catch (err2) {
            if (!(vC && aC)) throw err2;
            try {
              raw = await gum({ audio: aC }); // kamera yok/meşgul: yalnız mikrofon
              warn = "Kamera açılamadı (başka uygulama kullanıyor olabilir). Yalnız mikrofonla devam ediliyor.";
            } catch {
              raw = await gum({ video: vC }); // mikrofon yok: yalnız kamera
              warn = "Mikrofon bulunamadı. Yalnız kamera ile devam ediliyor.";
            }
          }
        }

        // Mikrofon sesini otomatik temizle (gürültü kapısı, filtre, kompresör)
        const cleaned = await cleanMicStream(raw);
        const stream = cleaned.stream;
        if (opts?.muted) stream.getAudioTracks().forEach((t) => (t.enabled = false));

        micCleanup.current?.();
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        micCleanup.current = cleaned.dispose;
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMediaKind("camera");
        for (const [, ctx] of peers.current) attachLocalTracks(ctx);
        if (warn) setError(warn);
        return true;
      } catch (err) {
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Kamera/mikrofon izni verilmedi. Tarayıcı izinlerini kontrol et."
            : "Medya başlatılamadı. Cihazını kontrol et.",
        );
        return false;
      }
    },
    [attachLocalTracks],
  );

  const stopScreen = useCallback(() => {
    screenCleanup.current?.();
    screenCleanup.current = null;
    localScreenRef.current?.getTracks().forEach((track) => track.stop());
    localScreenRef.current = null;
    setLocalScreen(null);
    for (const [, ctx] of peers.current) attachScreen(ctx);
  }, [attachScreen]);

  /** Yayıncı: oyun / maç / ekran paylaşımı; kameradan bağımsız ikinci video olarak gider. */
  const startScreen = useCallback(async () => {
    setError(null);
    try {
      // Site/oyun sesi yayına gitsin: sekme paylaşımında "sekme sesi", ekran/pencere paylaşımında "sistem sesi" dahil.
      // (Eski ayar systemAudio:"exclude" idi; bu yüzden paylaşılan sitenin sesi canlı ekrana hiç ulaşmıyordu.)
      // Yankı olmaması için yayıncı konuk/moderatör sesini KULAKLIKLA dinlemeli; sekme paylaşımında
      // suppressLocalAudioPlayback sekmenin kendi sesini yayıncının hoparlöründen keser.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...({ suppressLocalAudioPlayback: true } as Record<string, boolean>),
        },
        ...({ systemAudio: "include", selfBrowserSurface: "exclude", surfaceSwitching: "include" } as Record<string, string>),
      } as DisplayMediaStreamOptions);
      stream.getVideoTracks().forEach((t) => {
        t.contentHint = "motion";
      });
      screenCleanup.current?.();
      screenCleanup.current = null;
      localScreenRef.current?.getTracks().forEach((track) => track.stop());
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopScreen());
      localScreenRef.current = stream;
      setLocalScreen(stream);
      for (const [, ctx] of peers.current) attachScreen(ctx);
      if (!stream.getAudioTracks().length) {
        setError(
          "Ekran paylaşıldı ama SES paylaşılmadı. Paylaşım penceresinde “Sekme sesini de paylaş” (veya “Sistem sesini paylaş”) kutusunu işaretle. Ses için en sorunsuz yol: Chrome’da bir SEKME paylaşmak.",
        );
      } else {
        stream.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
      }
    } catch (err) {
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Ekran paylaşımı izni verilmedi."
          : "Ekran paylaşımı başlatılamadı.",
      );
    }
  }, [attachScreen, stopScreen]);

  /**
   * Yayıncı: cihazdaki video / görseli canlı ekrana koy (tüm izleyicilere WebRTC ile gider).
   * Ekran paylaşımıyla aynı kanalı kullanır; "Paylaşımı Durdur" ile kapanır.
   */
  const startMedia = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const url = URL.createObjectURL(file);
        let stream: MediaStream;
        let cleanup: () => void;

        if (file.type.startsWith("image/")) {
          const img = new Image();
          img.src = url;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = 1280;
          canvas.height = 720;
          const g = canvas.getContext("2d")!;
          const draw = () => {
            g.fillStyle = "#000";
            g.fillRect(0, 0, canvas.width, canvas.height);
            const r = Math.min(canvas.width / img.width, canvas.height / img.height);
            const w = img.width * r;
            const h = img.height * r;
            g.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
          };
          draw();
          const timer = window.setInterval(draw, 500); // akış kesilmesin
          stream = canvas.captureStream(5);
          cleanup = () => {
            window.clearInterval(timer);
            URL.revokeObjectURL(url);
          };
        } else if (file.type.startsWith("video/")) {
          const video = document.createElement("video");
          video.src = url;
          video.loop = true;
          video.playsInline = true;
          await video.play();
          const capture = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
          if (!capture) throw new Error("captureStream desteklenmiyor");
          stream = new MediaStream(capture.getVideoTracks());
          // Ses: yerel hoparlöre vermeden (yankı olmasın) doğrudan yayına gönder
          let ctx: AudioContext | null = null;
          try {
            ctx = new AudioContext();
            const src = ctx.createMediaElementSource(video);
            const dest = ctx.createMediaStreamDestination();
            src.connect(dest);
            dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
          } catch {
            capture.getAudioTracks().forEach((t) => stream.addTrack(t));
          }
          cleanup = () => {
            video.pause();
            video.removeAttribute("src");
            video.load();
            URL.revokeObjectURL(url);
            void ctx?.close().catch(() => undefined);
          };
        } else {
          URL.revokeObjectURL(url);
          throw new Error("unsupported");
        }

        screenCleanup.current?.();
        localScreenRef.current?.getTracks().forEach((track) => track.stop());
        screenCleanup.current = cleanup;
        localScreenRef.current = stream;
        setLocalScreen(stream);
        for (const [, ctx] of peers.current) attachScreen(ctx);
      } catch {
        setError("Bu dosya canlı ekrana alınamadı. MP4/WebM video veya JPG/PNG görsel dene (Chrome önerilir).");
      }
    },
    [attachScreen],
  );

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
    // TURN bilgisini al; bağlantılar bundan önce kurulduysa ayarı yeni bilgiyle güncelle
    void loadTurnServers().then((fresh) => {
      if (!fresh) return;
      for (const [, ctx] of peers.current) {
        try {
          const cfg = ctx.pc.getConfiguration();
          ctx.pc.setConfiguration({ ...cfg, iceServers: currentIceServers() });
        } catch {
          /* noop */
        }
      }
    });
    const signalTimer = setInterval(() => void pollSignals(), 500);
    const flushTimer = setInterval(() => void flushOutbox(), 150);
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
      micCleanup.current?.();
      micCleanup.current = null;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenCleanup.current?.();
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
    startMedia,
    stopScreen,
    toggleAudio,
    toggleVideo,
    syncParticipants,
    setRelaySources,
    processSignal,
    clearError: () => setError(null),
  };
}

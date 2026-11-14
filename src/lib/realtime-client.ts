"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageInfo } from "@/lib/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Supabase Realtime anahtarları tarayıcıya açık mı? */
export const realtimeConfigured = Boolean(URL && ANON);

let cached: SupabaseClient | null = null;

export function getRealtimeClient(): SupabaseClient | null {
  if (!realtimeConfigured) return null;
  if (!cached) {
    cached = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 40 } },
    });
  }
  return cached;
}

export type StreamBroadcast =
  | { type: "chat:new"; message: ChatMessageInfo }
  | { type: "chat:update"; ids: number[]; patch: { status?: string; isPinned?: boolean } }
  | { type: "chat:clear" }
  | { type: "signal"; from: number; to: number | null; kind: string; body: string }
  | { type: "stage"; text: string }
  | { type: "state" };

export type PresencePayload = { userId: number; nickname: string; role: string; stage: boolean };

export type StreamChannelHandle = {
  channel: RealtimeChannel | null;
  configured: boolean;
  status: "off" | "connecting" | "live" | "error";
  send: (event: StreamBroadcast) => void;
  track: (payload: PresencePayload) => void;
};

/**
 * Yayın kanalına katılır: broadcast (chat + WebRTC sinyalleri) ve presence
 * (canlı izleyici sayısı). Anahtarlar yoksa null döner ve uygulama polling'e
 * düşer — yani her ortamda çalışır.
 */
export function joinStreamChannel(options: {
  streamId: number;
  userId: number;
  nickname: string;
  role: string;
  onEvent: (event: StreamBroadcast) => void;
  onPresence?: (peers: PresencePayload[]) => void;
  onStatus?: (status: StreamChannelHandle["status"]) => void;
}): StreamChannelHandle {
  const client = getRealtimeClient();
  if (!client) {
    options.onStatus?.("off");
    return { channel: null, configured: false, status: "off", send: () => {}, track: () => {} };
  }

  const channel = client.channel(`bb:stream:${options.streamId}`, {
    config: { broadcast: { self: false }, presence: { key: String(options.userId) } },
  });

  let status: StreamChannelHandle["status"] = "connecting";
  options.onStatus?.(status);

  channel
    .on("broadcast", { event: "bb" }, ({ payload }) => {
      const event = payload as StreamBroadcast;
      if (!event?.type) return;
      if (event.type === "signal" && event.from === options.userId) return;
      options.onEvent(event);
    })
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresencePayload>();
      const peers: PresencePayload[] = [];
      for (const key of Object.keys(state)) {
        const slot = state[key]?.[0];
        if (slot) peers.push(slot);
      }
      options.onPresence?.(peers);
    })
    .subscribe((state) => {
      if (state === "SUBSCRIBED") {
        status = "live";
        channel.track({ userId: options.userId, nickname: options.nickname, role: options.role, stage: false });
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
        status = status === "live" ? "error" : status;
      }
      options.onStatus?.(status);
    });

  return {
    channel,
    configured: true,
    get status() {
      return status;
    },
    send(event) {
      if (status !== "live") return;
      void channel.send({ type: "broadcast", event: "bb", payload: event });
    },
    track(payload) {
      if (status !== "live") return;
      void channel.track(payload);
    },
  };
}

export function leaveStreamChannel(handle: StreamChannelHandle | null) {
  const client = getRealtimeClient();
  if (client && handle?.channel) {
    void client.removeChannel(handle.channel);
  }
  setActiveSender(null);
}

/* --------------------------------------------------------------------------
 * Global gönderici köprüsü: WebRTC motoru (hook) kanal handle'ını bilmeden
 * broadcast gönderebilsin diye aktif kanal buraya kaydedilir.
 * ------------------------------------------------------------------------ */
let activeSender: ((event: StreamBroadcast) => void) | null = null;

export function setActiveSender(sender: ((event: StreamBroadcast) => void) | null) {
  activeSender = sender;
}

export function sendBroadcast(event: StreamBroadcast) {
  activeSender?.(event);
}

export function isRealtimeLive() {
  return Boolean(activeSender);
}

/**
 * LiveKit sunucu tarafı (Supabase `live-token` + `guest-manage` edge function karşılığı).
 * Secret'lar yalnızca sunucuda okunur.
 */
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { HttpError } from "./auth";
import { livekitConfig } from "./env";

export const roomName = (channelId: number) => `channel-${channelId}`;

export function requireLivekit() {
  const cfg = livekitConfig();
  if (!cfg.ok) throw new HttpError(503, `Canlı yayın yapılandırılmamış. Eksik ortam değişkenleri: ${cfg.missing.join(", ")}`);
  return cfg;
}

export type LiveRole = "host" | "guest" | "viewer";
const TTL: Record<LiveRole, string> = { host: "6h", guest: "2h", viewer: "6h" };

export async function mintToken(opts: { role: LiveRole; channelId: number; identity: string; name: string }) {
  const cfg = requireLivekit();
  const at = new AccessToken(cfg.apiKey, cfg.apiSecret, {
    identity: opts.identity, name: opts.name, ttl: TTL[opts.role],
    metadata: JSON.stringify({ role: opts.role }),
  });
  const publish = opts.role !== "viewer";
  at.addGrant({
    room: roomName(opts.channelId), roomJoin: true, canSubscribe: true,
    canPublish: publish, canPublishData: publish,
    canPublishSources: opts.role === "guest" ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : undefined,
  });
  return { token: await at.toJwt(), url: cfg.url, room: roomName(opts.channelId) };
}

function rsc() {
  const cfg = requireLivekit();
  const http = cfg.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  return new RoomServiceClient(http, cfg.apiKey, cfg.apiSecret);
}

export async function kickParticipant(channelId: number, identity: string) {
  try { await rsc().removeParticipant(roomName(channelId), identity); } catch (e) { console.warn("[livekit] kick", String(e)); }
}

/** Konuğun mikrofon/kamera track'ini sunucu tarafında susturur. */
export async function muteParticipantSource(channelId: number, identity: string, source: "camera" | "mic", muted: boolean) {
  try {
    const client = rsc();
    const p = await client.getParticipant(roomName(channelId), identity);
    const want = source === "camera" ? TrackSource.CAMERA : TrackSource.MICROPHONE;
    for (const t of p.tracks) if (t.source === want) await client.mutePublishedTrack(roomName(channelId), identity, t.sid, muted);
  } catch (e) { console.warn("[livekit] mute", String(e)); }
}

export async function roomParticipantCount(channelId: number) {
  try { return (await rsc().listParticipants(roomName(channelId))).length; } catch { return null; }
}

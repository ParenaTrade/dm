"use client";

import { useEffect, useRef } from "react";
import { roleBadgeClass } from "@/lib/types";

export function VideoTile({
  stream,
  label,
  role,
  muted,
  cameraOn,
  micOn,
  handRaised,
  isLocal,
  accent,
  wide,
  state,
}: {
  stream: MediaStream | null;
  label: string;
  role: string;
  muted?: boolean;
  cameraOn: boolean;
  micOn: boolean;
  handRaised?: boolean;
  isLocal?: boolean;
  accent?: string;
  wide?: boolean;
  state?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream ?? null;
    }
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);

  const hasVideo = Boolean(
    cameraOn && stream && stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled),
  );

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink3 to-ink ${
        wide ? "aspect-video" : "aspect-video"
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full ${hasVideo ? "object-cover" : "opacity-0"} transition-opacity`}
      />

      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
            style={{
              background: `linear-gradient(140deg, ${accent ?? "#a855f7"}55, rgba(245,197,66,0.25))`,
              border: `1px solid ${accent ?? "#a855f7"}66`,
            }}
          >
            {label.slice(0, 1).toUpperCase()}
          </div>
          <p className="text-xs text-white/50">
            {!cameraOn ? "Kamera kapalı" : state === "connected" ? "Görüntü bekleniyor" : "Bağlanıyor..."}
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${roleBadgeClass(role)}`}>
          {role === "host" ? "Yayıncı" : role === "guest" ? "Konuk" : role === "moderator" ? "Mod" : "İzleyici"}
        </span>
        {handRaised && <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px]">✋</span>}
      </div>

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
        <span className="truncate rounded-lg bg-black/60 px-2 py-1 text-xs font-medium">{label}</span>
        <div className="flex items-center gap-1">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] ${
              micOn ? "bg-white/15" : "bg-red-600/70"
            }`}
            title={micOn ? "Mikrofon açık" : "Mikrofon kapalı"}
          >
            {micOn ? "🎙" : "🔇"}
          </span>
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] ${
              cameraOn ? "bg-white/15" : "bg-red-600/70"
            }`}
            title={cameraOn ? "Kamera açık" : "Kamera kapalı"}
          >
            {cameraOn ? "🎥" : "🚫"}
          </span>
        </div>
      </div>
    </div>
  );
}

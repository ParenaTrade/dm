"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Sahne videosu: ana ekran veya küçük popup için ortak oynatıcı. */
export function StageVideo({
  stream,
  muted,
  mirror,
  fit = "cover",
  showVideo = true,
  fallback,
  onDoubleClick,
  onClick,
  className = "",
  children,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  fit?: "cover" | "contain";
  showVideo?: boolean;
  fallback?: ReactNode;
  onDoubleClick?: () => void;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream ?? null;
    if (stream) {
      el.play().then(
        () => setBlocked(false),
        () => setBlocked(true),
      );
    }
  }, [stream]);

  const hasVideo = Boolean(
    showVideo && stream && stream.getVideoTracks().some((t) => t.readyState === "live" && t.enabled),
  );

  return (
    <div
      onDoubleClick={onDoubleClick}
      onClick={onClick}
      className={`relative overflow-hidden bg-black ${onDoubleClick || onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${
          mirror ? "-scale-x-100" : ""
        } ${hasVideo ? "" : "opacity-0"}`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ink3 to-ink text-center text-white/60">
          {fallback}
        </div>
      )}
      {blocked && stream && (
        <button
          onClick={() => void ref.current?.play().then(() => setBlocked(false))}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-sm font-bold text-gold"
        >
          🔊 Oynat / sesi aç
        </button>
      )}
      {children}
    </div>
  );
}

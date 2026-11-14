"use client";

import { useEffect, useRef } from "react";

/** Moderatör / konuk için sahne ekranının sol üstündeki küçük kare kendi kamera görüntüsü. */
export function SelfPip({
  stream,
  label,
  camOn,
  micOn,
  mediaOff,
  onToggleCam,
  onToggleMic,
  onStart,
}: {
  stream: MediaStream | null;
  label: string;
  camOn: boolean;
  micOn: boolean;
  mediaOff: boolean;
  onToggleCam: () => void;
  onToggleMic: () => void;
  onStart: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream ?? null;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);

  const showVideo = Boolean(stream && camOn && !mediaOff);

  return (
    <div className="absolute bottom-3 right-3 z-10 h-28 w-28 overflow-hidden rounded-2xl border-2 border-gold/60 bg-black shadow-xl shadow-black/60 sm:h-36 sm:w-36">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={`h-full w-full -scale-x-100 object-cover ${showVideo ? "" : "opacity-0"}`}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-ink3 to-ink text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-bold">
            {label.slice(0, 1).toUpperCase()}
          </span>
          {mediaOff ? (
            <button onClick={onStart} className="rounded-md bg-gold px-2 py-0.5 text-[10px] font-bold text-black">
              Kamerayı aç
            </button>
          ) : (
            <span className="text-[10px] text-white/50">Kamera kapalı</span>
          )}
        </div>
      )}
      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
        <span className="truncate rounded bg-black/60 px-1.5 py-0.5 text-[10px]">Sen</span>
        {!mediaOff && (
          <div className="flex gap-1">
            <button
              onClick={onToggleMic}
              title={micOn ? "Mikrofonu kapat" : "Mikrofonu aç"}
              className={`h-5 w-5 rounded text-[10px] ${micOn ? "bg-white/20" : "bg-red-600/80"}`}
            >
              {micOn ? "🎙" : "🔇"}
            </button>
            <button
              onClick={onToggleCam}
              title={camOn ? "Kamerayı kapat" : "Kamerayı aç"}
              className={`h-5 w-5 rounded text-[10px] ${camOn ? "bg-white/20" : "bg-red-600/80"}`}
            >
              {camOn ? "🎥" : "🚫"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

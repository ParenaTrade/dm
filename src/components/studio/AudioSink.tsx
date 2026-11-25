"use client";

import { useEffect, useRef } from "react";

/**
 * Uzaktaki bir katılımcının (veya paylaşılan ekranın) sesini oynatan gizli oynatıcı.
 * Görüntü kutuları (liste, popup, ana ekran) sessiz olduğundan ses TEK yerden gelir:
 * kutu gizlense/kapansa bile ses kesilmez, aynı ses iki kez çalıp yankı yapmaz.
 */
export function AudioSink({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.volume = 1;
    const tryPlay = () => {
      if (el.paused) void el.play().catch(() => undefined);
    };
    tryPlay();
    // Ses izi akışa sonradan eklenirse (ekran paylaşımında ses sonra gelebilir) yeniden başlat
    const onTrack = () => {
      el.srcObject = stream;
      tryPlay();
    };
    stream.addEventListener("addtrack", onTrack);
    // Tarayıcı otomatik sesi engellediyse ilk dokunuş/tıklamada başlat
    window.addEventListener("pointerdown", tryPlay);
    window.addEventListener("keydown", tryPlay);
    window.addEventListener("touchstart", tryPlay);
    const retry = setInterval(tryPlay, 2000);
    return () => {
      stream.removeEventListener("addtrack", onTrack);
      window.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("keydown", tryPlay);
      window.removeEventListener("touchstart", tryPlay);
      clearInterval(retry);
    };
  }, [stream]);

  // Dinleme açılınca (muted -> false) oynatmayı tekrar dene
  useEffect(() => {
    const el = ref.current;
    if (el && !muted) void el.play().catch(() => undefined);
  }, [muted]);

  return <audio ref={ref} autoPlay muted={muted} className="hidden" />;
}

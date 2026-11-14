"use client";

import { useEffect, useRef } from "react";

/**
 * Uzaktaki bir katılımcının sesini oynatan gizli oynatıcı.
 * Görüntü kutuları (liste, popup, ana ekran) sessiz olduğundan ses TEK yerden gelir:
 * kutu gizlense/kapansa bile ses kesilmez, aynı ses iki kez çalıp yankı yapmaz.
 */
export function AudioSink({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    const tryPlay = () => void el.play().catch(() => undefined);
    tryPlay();
    // Tarayıcı otomatik sesi engellediyse ilk dokunuş/tıklamada başlat
    window.addEventListener("pointerdown", tryPlay);
    window.addEventListener("keydown", tryPlay);
    return () => {
      window.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("keydown", tryPlay);
    };
  }, [stream]);

  return <audio ref={ref} autoPlay muted={muted} className="hidden" />;
}

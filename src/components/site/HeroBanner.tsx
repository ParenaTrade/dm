"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { LiveStudio } from "@/components/studio/LiveStudio";
import { Disclosure } from "@/components/site/Disclosure";

/**
 * Ana sayfa banner alanı.
 * - Yayın YOKKEN: tanıtım metni + sağda küçük kare "canlı ekran" kutusu.
 * - Yayın VARKEN: canlı ekran (+ sohbet) banner alanının tamamını kaplar.
 * Durum sayfa yenilenmeden otomatik güncellenir.
 * Giriş yapmayan ziyaretçi de canlı yayını izler (misafir oturumu); mesaj yazmak için giriş gerekir.
 */
export function HeroBanner({
  initialLive,
  initialTitle,
  posterUrl,
  children,
}: {
  initialLive: boolean;
  initialTitle: string;
  posterUrl: string | null;
  children: ReactNode;
}) {
  const [live, setLive] = useState(initialLive);
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/stream", { cache: "no-store" });
        const data = await res.json();
        if (cancelled || !data.ok) return;
        setLive(data.stream?.status === "live");
        if (data.stream?.title) setTitle(data.stream.title as string);
      } catch {
        /* noop */
      }
    };
    const timer = setInterval(() => void load(), live ? 10000 : 6000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [live]);

  if (live) {
    return (
      <div id="canli" className="relative mx-auto max-w-7xl scroll-mt-24 px-4 pb-10 pt-8 sm:px-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold tracking-wider">
            <span className="live-dot h-2 w-2 rounded-full bg-white" />
            ŞİMDİ CANLI
          </span>
          <h1 className="font-display gold-text min-w-0 truncate text-2xl sm:text-3xl">{title}</h1>
        </div>
        <LiveStudio mode="viewer" embedded posterUrl={posterUrl} />
        <div className="mt-3">
          <Disclosure compact />
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 lg:pt-20">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">{children}</div>

        {/* Yayın yokken küçük kare canlı ekran */}
        <Link
          id="canli"
          href="/izle"
          className="group relative block aspect-square w-48 shrink-0 scroll-mt-24 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-violet/40 via-ink2 to-neon/30 shadow-2xl transition hover:border-gold/60 sm:w-60"
          aria-label="Canlı yayın ekranı (şu an yayın dışı)"
        >
          {posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterUrl} alt="Berkbey canlı yayın" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/20" />
          <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-4 text-center">
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold tracking-wider text-white/80">
              <span className="h-2 w-2 rounded-full bg-white/50" />
              YAYIN DIŞI
            </span>
            <p className="font-display gold-text line-clamp-2 text-lg leading-tight">{title}</p>
            <span className="text-[11px] text-white/60 transition group-hover:text-gold">Yayın başlayınca burası büyüyecek</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

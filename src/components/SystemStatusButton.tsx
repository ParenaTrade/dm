"use client";

import { useEffect, useState } from "react";

/** İzleyici görünümü: yalnızca Aktif (yeşil) / Pasif (kırmızı) düğmesi, ayrıntı yok. */
export function SystemStatusButton({ large }: { large?: boolean }) {
  const [active, setActive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/system", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!cancelled) setActive(Boolean(res.ok && data?.active));
      } catch {
        if (!cancelled) setActive(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const on = active === true;
  const size = large ? "px-10 py-4 text-xl" : "px-3 py-1.5 text-xs";
  return (
    <span
      role="status"
      aria-label={on ? "Sistem aktif" : "Sistem pasif"}
      className={`inline-flex items-center gap-2 rounded-full font-bold text-white ${size} ${
        active === null ? "bg-white/20" : on ? "bg-emerald-600" : "bg-red-600"
      }`}
    >
      <span className={`${large ? "h-3 w-3" : "h-2 w-2"} rounded-full bg-white ${on ? "live-dot" : ""}`} />
      {active === null ? "Kontrol ediliyor" : on ? "Aktif" : "Pasif"}
    </span>
  );
}

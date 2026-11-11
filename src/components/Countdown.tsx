"use client";
import { useEffect, useState } from "react";
import { timeLeft } from "@/lib/client";

export default function Countdown({ to, className }: { to: string | Date; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return <span className={`tabular-nums ${className ?? ""}`}>{now === null ? "--:--:--" : timeLeft(to, now)}</span>;
}

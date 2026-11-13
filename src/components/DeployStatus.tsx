"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SystemInfo = {
  ok: boolean;
  db: {
    provider: "supabase" | "postgres";
    host: string;
    database: string;
    port: string;
    ssl: boolean;
    pooler: boolean;
    via: string;
    connected: boolean;
    error?: string;
    bootstrapped: boolean;
    bootError?: string;
  };
  tables: { table: string; rows: number }[];
  realtime: {
    configured: boolean;
    url: boolean;
    anonKey: boolean;
    rest: boolean;
    restError?: string;
  };
  deployment: string;
  region: string;
};

const ENV_ROWS: { key: string; label: string; where: string; hint: string }[] = [
  {
    key: "SUPABASE_DB_URL",
    label: "Supabase veritabanı bağlantısı",
    where: "Supabase → Project Settings → Database → Connection string → URI (Transaction pooler / port 6543)",
    hint: "Şifreyi [YOUR-PASSWORD] kısmına yaz. Vercel → Settings → Environment Variables.",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    label: "Realtime / REST projesi",
    where: "Supabase → Project Settings → API → Project URL",
    hint: "Bu değişken tarayıcıya açılır (NEXT_PUBLIC_).",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    label: "Realtime anon anahtarı",
    where: "Supabase → Project Settings → API → Project API keys → anon public",
    hint: "Broadcast + presence için gerekli. Realtime'ı açar (anlık chat/sinyal).",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    label: "Sunucu tarafı admin (opsiyonel)",
    where: "Supabase → Project Settings → API → service_role",
    hint: "Sadece sunucu. Saklama işleri / admin işlemleri için.",
  },
  {
    key: "HOST_PASSWORD",
    label: "Yayıncı panel şifresi",
    where: "Sen belirle (varsayılan: berkbey)",
    hint: "Canlıya çıkmadan önce mutlaka değiştir.",
  },
];

export function DeployStatus() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/system", { cache: "no-store" });
      const data = await res.json();
      if (data.ok === false && data.db?.error) {
        setError(data.db.error);
        setInfo(data as SystemInfo);
        return;
      }
      setInfo(data as SystemInfo);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sistem bilgisi alınamadı");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  const ok = info?.ok ?? false;
  const supabaseMode = info?.db.provider === "supabase";
  const realtimeReady = info?.realtime.configured && info?.realtime.rest;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display gold-text text-4xl">Canlı Sistem Durumu</p>
          <p className="text-sm text-white/55">
            Supabase tabloları, Realtime köprüsü ve Vercel deployment kontrolü
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/canli" className="btn-gold rounded-full px-5 py-2.5 text-sm font-bold">
            ▶ Stüdyoya Git
          </Link>
          <Link href="/" className="btn-ghost rounded-full px-5 py-2.5 text-sm">
            Ana Sayfa
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className={`rounded-3xl p-5 border ${ok ? "border-emerald-400/40 bg-emerald-500/10" : "border-red-400/40 bg-red-500/10"}`}>
          <p className="text-xs uppercase tracking-wider text-white/60">Veritabanı</p>
          <p className="mt-1 font-display text-2xl">{ok ? "Bağlı" : "Hata"}</p>
          <p className="mt-2 text-xs text-white/60">
            {supabaseMode ? "Supabase Postgres" : "Yerel Postgres"} · {info?.db.host ?? "-"} ·{" "}
            {info?.db.pooler ? "pooler 6543" : `port ${info?.db.port ?? "-"}`} · {info?.db.ssl ? "TLS" : "yerel"}
          </p>
          <p className="mt-1 text-[11px] text-white/40">değişken: {info?.db.via ?? "-"}</p>
        </div>

        <div className={`rounded-3xl p-5 border ${realtimeReady ? "border-emerald-400/40 bg-emerald-500/10" : "border-amber-400/40 bg-amber-500/10"}`}>
          <p className="text-xs uppercase tracking-wider text-white/60">Supabase Realtime</p>
          <p className="mt-1 font-display text-2xl">{realtimeReady ? "Gerçek Canlı" : "Yedek Mod"}</p>
          <p className="mt-2 text-xs text-white/60">
            {realtimeReady
              ? "Chat + WebRTC sinyalleri websocket ile anlık iletiliyor."
              : "Anahtarlar yok: uygulama REST polling ile çalışıyor (yine canlı, gecikme ~1.5 sn)."}
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            URL: {info?.realtime.url ? "✓" : "✕"} · anon key: {info?.realtime.anonKey ? "✓" : "✕"} · REST:{" "}
            {info?.realtime.rest ? "✓" : "✕"}
          </p>
        </div>

        <div className="glass-dark rounded-3xl p-5">
          <p className="text-xs uppercase tracking-wider text-white/60">Deployment</p>
          <p className="mt-1 font-display text-2xl">{info?.deployment === "vercel" ? "Vercel" : "Yerel / Sandbox"}</p>
          <p className="mt-2 text-xs text-white/60">
            Region: {info?.region ?? "-"} · Node runtime · şema otomatik kurulur
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            Tablolar {info?.db.bootstrapped ? "hazır ✓" : "hazırlanıyor…"}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass-dark rounded-3xl p-5">
          <p className="font-display text-xl">Tablo Bağlantıları</p>
          <p className="mt-1 text-xs text-white/50">
            10 tablo, otomatik oluşturuldu. Satır sayıları canlı olarak okunuyor.
          </p>
          <div className="mt-4 space-y-1.5 text-sm">
            {(info?.tables ?? []).map((t) => (
              <div key={t.table} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2">
                <span className="font-mono text-xs text-white/75">{t.table}</span>
                <span className="text-gold tabular-nums">{t.rows}</span>
              </div>
            ))}
            {info && info.tables.length === 0 && (
              <p className="text-sm text-white/50">Tablolar henüz oluşmadı.</p>
            )}
          </div>
        </div>

        <div className="glass-dark rounded-3xl p-5">
          <p className="font-display text-xl">Vercel Environment Variables</p>
          <p className="mt-1 text-xs text-white/50">
            Vercel → Project → Settings → Environment Variables bölümüne ekle. Supabase değerlerini kopyala-yapıştır.
          </p>
          <div className="mt-4 space-y-3">
            {ENV_ROWS.map((row) => (
              <div key={row.key} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <p className="font-mono text-xs text-gold">{row.key}</p>
                <p className="mt-1 text-sm text-white/75">{row.label}</p>
                <p className="mt-1 text-xs text-white/45">{row.where}</p>
                <p className="mt-1 text-[11px] text-cyan-200/80">{row.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-dark mt-6 rounded-3xl p-5">
        <p className="font-display text-xl">3 Adımda Gerçek Canlı Mod</p>
        <ol className="mt-4 space-y-3 text-sm text-white/70">
          <li>
            <span className="font-bold text-gold">1.</span> Supabase projesi oluştur → Project Settings → Database →
            Connection string (URI) al, şifreyi gir. <span className="font-mono text-xs text-gold">SUPABASE_DB_URL</span>{" "}
            olarak Vercel'e ekle. Tablolar ilk istekte otomatik oluşur (istersen{" "}
            <span className="font-mono text-xs text-gold">supabase/schema.sql</span> dosyasını SQL Editor'de çalıştır).
          </li>
          <li>
            <span className="font-bold text-gold">2.</span> Project Settings → API → Project URL ve anon key al →{" "}
            <span className="font-mono text-xs text-gold">NEXT_PUBLIC_SUPABASE_URL</span> ve{" "}
            <span className="font-mono text-xs text-gold">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> olarak ekle. Böylece
            chat + WebRTC sinyalleri Realtime websocket'e taşınır (Pooling modundan çıkılır).
          </li>
          <li>
            <span className="font-bold text-gold">3.</span> Vercel'e deploy et (<span className="font-mono text-xs text-gold">vercel --prod</span>{" "}
            ya da GitHub bağlantısı). Sonra bu sayfada &quot;Gerçek Canlı&quot; rozetini gör — stüdyo artık üretim modunda.
          </li>
        </ol>
      </div>
    </div>
  );
}

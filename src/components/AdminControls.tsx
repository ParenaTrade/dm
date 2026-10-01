"use client";

import { useState } from "react";

export default function AdminControls({
  packages,
  frauds,
}: {
  packages: { code: string; name: string; priceMonthlyCents: number }[];
  frauds: { id: string; reason: string; status: string; signals: string[] }[];
}) {
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(packages.map((p) => [p.code, Math.round(p.priceMonthlyCents / 100)]))
  );
  const [msg, setMsg] = useState("");
  const [fraudState, setFraudState] = useState(frauds);

  async function savePrice(code: string) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "package_price", code, priceMonthlyCents: (prices[code] ?? 0) * 100 }),
    });
    const data = await res.json();
    setMsg(data.ok ? `${code} paketi güncellendi.` : (data.error ?? "Hata oluştu."));
    setTimeout(() => setMsg(""), 2600);
  }

  async function resolve(id: string, status: "CLEARED" | "BLOCKED") {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "fraud_resolve", id, status }),
    });
    setFraudState((f) => f.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Paket fiyat yönetimi */}
      <div className="border-2 border-murekkep/12 bg-white/55">
        <div className="border-b-2 border-murekkep/12 px-5 py-3.5">
          <h2 className="font-display text-[1.08rem] font-bold">Paket fiyatları</h2>
          <p className="mt-1.5 text-[0.8rem] text-murekkep-soft">
            Fiyatlar kod içine gömülü değildir. Değişiklik tüm panellere anında yansır.
          </p>
        </div>
        <ul className="p-5">
          {packages.map((p) => (
            <li key={p.code} className="flex flex-wrap items-center gap-3 border-b border-dashed border-murekkep/20 py-3 last:border-0">
              <div className="min-w-[120px] flex-1">
                <p className="font-semibold">{p.name}</p>
                <p className="tabular text-[0.76rem] text-sicak-gri">{p.code}</p>
              </div>
              <input
                type="number"
                min={0}
                value={prices[p.code] ?? 0}
                onChange={(e) => setPrices((s) => ({ ...s, [p.code]: Number(e.target.value) }))}
                className="tabular w-[120px] border-2 border-murekkep/15 bg-kagit px-3 py-2 text-[0.9rem] focus:border-damping focus:outline-none"
              />
              <span className="text-[0.82rem] text-sicak-gri">TL / ay</span>
              <button
                onClick={() => void savePrice(p.code)}
                className="border-2 border-damping bg-damping px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-kagit hover:bg-damping-dark"
              >
                Kaydet
              </button>
            </li>
          ))}
        </ul>
        {msg ? <p className="border-t-2 border-murekkep/12 px-5 py-3 text-[0.82rem] text-[#1f6f4a]">{msg}</p> : null}
      </div>

      {/* Fraud incelemesi */}
      <div className="border-2 border-murekkep/12 bg-white/55">
        <div className="border-b-2 border-murekkep/12 px-5 py-3.5">
          <h2 className="font-display text-[1.08rem] font-bold">Fraud incelemesi</h2>
          <p className="mt-1.5 text-[0.8rem] text-murekkep-soft">
            Self referral, aynı cihaz, olağandışı kullanım ve tekrar eden QR sinyalleri.
          </p>
        </div>
        <ul className="p-5">
          {fraudState.length === 0 ? (
            <li className="border-2 border-dashed border-murekkep/20 px-5 py-8 text-center text-[0.86rem] text-murekkep-soft">
              İnceleme bekleyen kayıt yok.
            </li>
          ) : (
            fraudState.map((f) => (
              <li key={f.id} className="border-b border-dashed border-murekkep/20 py-3.5 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{f.reason}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(f.signals ?? []).map((s) => (
                        <span key={s} className="border border-damping/40 px-2 py-0.5 text-[0.66rem] text-damping">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  {f.status === "OPEN" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void resolve(f.id, "CLEARED")}
                        className="border-2 border-[#1f6f4a] px-3.5 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.11em] text-[#1f6f4a] hover:bg-[#1f6f4a] hover:text-kagit"
                      >
                        Temizle
                      </button>
                      <button
                        onClick={() => void resolve(f.id, "BLOCKED")}
                        className="border-2 border-damping px-3.5 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.11em] text-damping hover:bg-damping hover:text-kagit"
                      >
                        Engelle
                      </button>
                    </div>
                  ) : (
                    <span className="border border-murekkep/20 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.11em] text-murekkep-soft">
                      {f.status}
                    </span>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

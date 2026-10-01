"use client";

import { useState } from "react";
import { QrCode, Check, Copy } from "lucide-react";

export default function QrOffer({
  businessId,
  campaignId,
  code,
  label = "QR fırsatını al",
}: {
  businessId: string;
  campaignId: string;
  code: string;
  label?: string;
}) {
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create() {
    setCreated(true);
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "qr_generated", businessId, campaignId, meta: { code } }),
    }).catch(() => {});
  }

  return (
    <div>
      {!created ? (
        <button
          onClick={create}
          className="inline-flex w-full items-center justify-center gap-2 border-2 border-damping bg-damping px-5 py-3.5 text-[0.8rem] font-semibold uppercase tracking-[0.13em] text-kagit transition-colors hover:bg-damping-dark"
        >
          <QrCode className="h-4 w-4" /> {label}
        </button>
      ) : (
        <div className="border-2 border-murekkep bg-kagit p-4">
          <div className="flex items-start gap-4">
            <svg width="86" height="86" viewBox="0 0 21 21" aria-label="QR kodu" role="img">
              <rect width="21" height="21" fill="var(--color-kagit)" />
              {Array.from({ length: 21 * 21 }).map((_, i) => {
                const x = i % 21;
                const y = Math.floor(i / 21);
                const finder =
                  (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
                const on = finder
                  ? (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5) ||
                      (x > 15 && x < 19 && y > 1 && y < 5) || (x > 1 && x < 5 && y > 15 && y < 19))
                  : (x * 7 + y * 13 + (x * y)) % 3 === 0;
                return on ? (
                  <rect key={i} x={x} y={y} width="1" height="1" fill="var(--color-murekkep)" />
                ) : null;
              })}
            </svg>
            <div className="flex-1">
              <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#1f6f4a]">
                <Check className="h-3.5 w-3.5" /> QR oluşturuldu
              </p>
              <p className="tabular mt-2 text-[1.05rem] font-semibold tracking-[0.1em]">{code}</p>
              <p className="mt-1.5 text-[0.72rem] leading-relaxed text-murekkep-soft">
                Kasada bu kodu göster. Kampanya koşulları sağlandığında indirim otomatik uygulanır.
              </p>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(code).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-murekkep-soft hover:text-damping"
              >
                <Copy className="h-3.5 w-3.5" /> {copied ? "Kopyalandı" : "Kodu kopyala"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

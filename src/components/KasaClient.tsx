"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, Keyboard, Check, Loader2, RotateCcw, Wallet, AlertTriangle } from "lucide-react";

type Issue = { code: string; message: string };
type Breakdown = {
  grossAmountCents: number;
  discountCents: number;
  dampingUsedCents: number;
  netAmountCents: number;
  commissionBaseCents: number;
  commissionRate: number;
  commissionCents: number;
  poolContributionCents: number;
  dampingEarnedCents: number;
};

type Resolved = {
  qr: { code: string; status: string } | null;
  campaign: {
    id: string;
    code: string;
    title: string;
    discountPercent: number;
    minBasketCents: number;
    timeStart: string | null;
    timeEnd: string | null;
  } | null;
  customer: { id: string; name: string; email: string } | null;
  wallet: { availableCents: number } | null;
  alreadyUsed: boolean;
};

const tr = (c: number) =>
  (Math.abs(c) / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function KasaClient({
  businessId,
  businessName,
  district,
  actorEmail,
  role,
  qrCodes,
  campaigns,
  contractBase,
}: {
  businessId: string;
  businessName: string;
  district: string;
  actorEmail: string;
  role: string;
  qrCodes: { code: string; status: string; customerId: string | null }[];
  campaigns: { id: string; code: string; title: string; discountPercent: number }[];
  contractBase: string;
}) {
  const [mode, setMode] = useState<"qr" | "kod">("qr");
  const [code, setCode] = useState("");
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [gross, setGross] = useState<number>(0);
  const [useDamping, setUseDamping] = useState(false);
  const [payMethod, setPayMethod] = useState("NAKIT");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ receiptNo: string; breakdown: Breakdown; remaining: number } | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const resolve = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setBusy(true);
    setError("");
    setIssues([]);
    setDone(null);
    setBreakdown(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: value.trim() }),
      });
      const data = (await res.json()) as Resolved & { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Kod çözümlenemedi.");
        setResolved(null);
      } else {
        setResolved(data);
        setStep(2);
        if (data.alreadyUsed) setError("Bu QR daha önce kullanılmış.");
      }
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    }
    setBusy(false);
  }, []);

  const preview = useCallback(async () => {
    if (!resolved?.campaign || gross <= 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/kasa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "onizleme",
          businessId,
          campaignId: resolved.campaign.id,
          code: resolved.qr?.code ?? null,
          grossAmountCents: Math.round(gross * 100),
          dampingUseCents: useDamping ? Math.min((resolved.wallet?.availableCents ?? 0), 99999999) : 0,
          customerId: resolved.customer?.id ?? null,
        }),
      });
      const data = await res.json();
      if (data.breakdown) {
        setBreakdown(data.breakdown);
        setIssues(data.issues ?? []);
        setStep(3);
      } else {
        setError(data.error ?? "Hesaplama yapılamadı.");
      }
    } catch {
      setError("Hesaplama hatası.");
    }
    setBusy(false);
  }, [resolved, gross, useDamping, businessId]);

  useEffect(() => {
    if (step >= 2 && resolved?.campaign && gross > 0 && !done) {
      const t = setTimeout(() => void preview(), 320);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gross, useDamping]);

  async function complete() {
    if (!resolved?.campaign) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/kasa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "tamamla",
        businessId,
        campaignId: resolved.campaign.id,
        code: resolved.qr?.code ?? resolved.campaign.code,
        grossAmountCents: Math.round(gross * 100),
        dampingUseCents: breakdown?.dampingUsedCents ?? 0,
        paymentMethod: payMethod,
        actorEmail,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setDone({
        receiptNo: data.receiptNo,
        breakdown: data.breakdown,
        remaining: data.dampingRemainingCents ?? 0,
      });
      setStep(4);
    } else {
      const msgs = (data.issues ?? []).map((i: Issue) => i.message).join(" ");
      setError(msgs || data.error || "İşlem tamamlanamadı.");
      if (data.issues?.some((i: Issue) => i.code === "QR_USED")) setStep(1);
    }
    setBusy(false);
  }

  function reset() {
    setCode("");
    setResolved(null);
    setGross(0);
    setUseDamping(false);
    setBreakdown(null);
    setDone(null);
    setError("");
    setIssues([]);
    setStep(1);
    inputRef.current?.focus();
  }

  const activeQr = qrCodes.find((q) => q.status === "ACTIVE");
  const b = done?.breakdown ?? breakdown;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      {/* ---------------------------- SOL: AKIŞ ---------------------------- */}
      <div>
        {/* Adım göstergesi */}
        <ol className="mb-7 flex flex-wrap items-center gap-2">
          {["QR / Kod", "Tutar", "İndirim", "Ödeme"].map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3 | 4;
            const state = step === n ? "active" : step > n ? "done" : "todo";
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center border-2 text-[0.76rem] font-semibold ${
                    state === "active"
                      ? "border-damping bg-damping text-kagit"
                      : state === "done"
                        ? "border-murekkep bg-murekkep text-kagit"
                        : "border-murekkep/20 text-sicak-gri"
                  }`}
                >
                  {state === "done" ? <Check className="h-3.5 w-3.5" /> : n}
                </span>
                <span
                  className={`text-[0.72rem] font-semibold uppercase tracking-[0.11em] ${
                    state === "todo" ? "text-sicak-gri" : "text-murekkep"
                  }`}
                >
                  {label}
                </span>
                {i < 3 ? <span className="mx-1 h-px w-6 bg-murekkep/20" /> : null}
              </li>
            );
          })}
        </ol>

        {/* 1. QR / KOD */}
        <section className="border-2 border-murekkep/12 bg-white/55">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-murekkep/12 px-6 py-4">
            <h2 className="font-display text-[1.22rem] font-bold">Müşteri QR&apos;ını okut</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("qr")}
                className={`inline-flex items-center gap-2 border-2 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${
                  mode === "qr" ? "border-murekkep bg-murekkep text-kagit" : "border-murekkep/20 text-murekkep-soft"
                }`}
              >
                <QrCode className="h-3.5 w-3.5" /> QR okut
              </button>
              <button
                onClick={() => setMode("kod")}
                className={`inline-flex items-center gap-2 border-2 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${
                  mode === "kod" ? "border-murekkep bg-murekkep text-kagit" : "border-murekkep/20 text-murekkep-soft"
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" /> Kod gir
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-wrap gap-3">
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void resolve(code);
                }}
                placeholder={mode === "qr" ? "QR tarayıcı hazır — okutulan kod buraya düşer" : "Örn. QR-KADIKO-1000"}
                className="tabular min-w-[260px] flex-1 border-2 border-murekkep/15 bg-kagit px-4 py-3.5 text-[1.05rem] tracking-[0.08em] focus:border-damping focus:outline-none"
              />
              <button
                onClick={() => void resolve(code)}
                disabled={busy || !code.trim()}
                className="inline-flex items-center gap-2 border-2 border-damping bg-damping px-6 py-3.5 text-[0.8rem] font-semibold uppercase tracking-[0.13em] text-kagit hover:bg-damping-dark disabled:opacity-45"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Doğrula
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[0.72rem] text-sicak-gri">Hızlı test kodları:</span>
              {(activeQr ? [activeQr.code] : []).concat(campaigns.map((c) => c.code)).slice(0, 4).map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCode(c);
                    void resolve(c);
                  }}
                  className="tabular border border-murekkep/20 px-2.5 py-1.5 text-[0.72rem] hover:border-damping hover:text-damping"
                >
                  {c}
                </button>
              ))}
            </div>

            {error ? (
              <p className="mt-4 flex items-start gap-2 border-2 border-damping bg-damping-soft/50 px-4 py-3 text-[0.85rem] text-damping-dark">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            ) : null}

            {resolved ? (
              <div className="mt-5 grid gap-3 border-2 border-murekkep/12 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Müşteri</p>
                  <p className="mt-1 font-semibold">{resolved.customer?.name ?? "Misafir müşteri"}</p>
                  <p className="text-[0.74rem] text-murekkep-soft">{resolved.customer?.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Kampanya</p>
                  <p className="mt-1 font-semibold">{resolved.campaign?.title ?? "—"}</p>
                  <p className="tabular text-[0.74rem] text-damping">
                    %{resolved.campaign?.discountPercent ?? 0} damping
                  </p>
                </div>
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">
                    Damping Hane
                  </p>
                  <p className="tabular mt-1 font-semibold">{tr(resolved.wallet?.availableCents ?? 0)} TL</p>
                  <p className="text-[0.74rem] text-murekkep-soft">kullanılabilir bakiye</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* 2. TUTAR */}
        {resolved ? (
          <section className="mt-6 border-2 border-murekkep/12 bg-white/55">
            <div className="border-b-2 border-murekkep/12 px-6 py-4">
              <h2 className="font-display text-[1.22rem] font-bold">Satış tutarını gir</h2>
              <p className="mt-1.5 text-[0.82rem] text-murekkep-soft">
                Müşteri ödemeyi doğrudan işletmeye yapar. DampingVar ödeme tahsil etmez.
              </p>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center border-2 border-murekkep/15 bg-kagit">
                  <span className="px-4 py-3.5 text-[1.25rem] text-sicak-gri">₺</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={gross || ""}
                    onChange={(e) => setGross(Math.max(0, Number(e.target.value)))}
                    placeholder="0,00"
                    className="tabular w-[220px] bg-transparent px-2 py-3.5 text-[1.65rem] font-semibold focus:outline-none"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-3 border-2 border-murekkep/15 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={useDamping}
                    onChange={(e) => setUseDamping(e.target.checked)}
                    className="h-4 w-4 accent-[#d6362b]"
                  />
                  <Wallet className="h-4 w-4 text-damping" />
                  <span className="text-[0.82rem] font-semibold">
                    Damping Hane kullan ({tr(resolved.wallet?.availableCents ?? 0)} TL)
                  </span>
                </label>

                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="border-2 border-murekkep/15 bg-kagit px-4 py-3.5 text-[0.85rem] focus:border-damping focus:outline-none"
                >
                  <option value="NAKIT">Nakit</option>
                  <option value="KART">Kredi kartı</option>
                  <option value="HAVALE">Havale / EFT</option>
                </select>
              </div>

              {issues.length ? (
                <ul className="mt-4 space-y-1.5">
                  {issues.map((i) => (
                    <li key={i.code} className="flex items-start gap-2 text-[0.82rem] text-damping">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {i.message}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={complete}
                  disabled={busy || !breakdown || issues.length > 0 || !!done}
                  className="inline-flex items-center gap-2 border-2 border-[#1f6f4a] bg-[#1f6f4a] px-7 py-3.5 text-[0.82rem] font-semibold uppercase tracking-[0.13em] text-kagit hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Ödeme alındı / işlemi tamamla
                </button>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 border-2 border-murekkep/20 px-5 py-3.5 text-[0.78rem] font-semibold uppercase tracking-[0.13em] text-murekkep-soft hover:border-murekkep hover:text-murekkep"
                >
                  <RotateCcw className="h-4 w-4" /> Yeni işlem
                </button>
                <p className="text-[0.72rem] text-sicak-gri">
                  Rol: {role} · Komisyon: {contractBase === "AFTER_DAMPING" ? "indirim + Damping Hane sonrası" : contractBase}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {/* ----------------------------- SAĞ: FİŞ ----------------------------- */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="mx-auto max-w-[380px]">
          <div className="perforated-top h-3 w-full" />
          <div className="relative bg-kagit px-6 pb-6 pt-2 shadow-[0_20px_60px_rgba(18,33,47,0.18)]">
            <div className="text-center">
              <p className="font-display text-[1.05rem] font-bold uppercase tracking-[0.18em]">DampingVar</p>
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.22em] text-sicak-gri">Damping Kasa · Fiş</p>
            </div>

            <div className="dashed-rule my-4" />

            <div className="space-y-1.5 text-[0.76rem]">
              <Line label="İŞLETME" value={businessName} />
              <Line label="ŞUBE" value={district} />
              <Line label="KASİYER" value={actorEmail.split("@")[0]} />
              <Line label="TARİH" value={new Date().toLocaleString("tr-TR")} />
              {done ? <Line label="FİŞ NO" value={done.receiptNo} strong /> : null}
            </div>

            <div className="dashed-rule my-4" />

            <div className="space-y-2.5">
              <ReceiptLine
                label="SATIŞ"
                value={`${tr(gross)} ₺`}
                visible={gross > 0}
              />
              <ReceiptLine
                label={resolved?.campaign ? `KAMPANYA İNDİRİMİ (%${resolved.campaign.discountPercent})` : "KAMPANYA İNDİRİMİ"}
                value={`-${tr(b?.discountCents ?? 0)} ₺`}
                visible={!!b && b.discountCents > 0}
                tone="damping"
              />
              <ReceiptLine
                label="DAMPING HANE KULLANIMI"
                value={`-${tr(b?.dampingUsedCents ?? 0)} ₺`}
                visible={!!b && b.dampingUsedCents > 0}
                tone="damping"
              />
            </div>

            <div className="dashed-rule my-4" />

            <div className="flex items-baseline justify-between">
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em]">Ödenecek tutar</span>
              <span className="tabular text-[1.62rem] font-semibold leading-none">
                {tr(b?.netAmountCents ?? 0)} ₺
              </span>
            </div>

            <div className="dashed-rule my-4" />

            <div className="space-y-2">
              <ReceiptLine
                label={`DAMPINGVAR KOMİSYONU (%${(((b?.commissionRate ?? 0) * 100).toFixed(1))})`}
                value={`${tr(b?.commissionCents ?? 0)} ₺`}
                visible={!!b}
              />
              <ReceiptLine label="ORTAK HAVUZ KATKISI" value={`${tr(b?.poolContributionCents ?? 0)} ₺`} visible={!!b} />
              <ReceiptLine
                label="MÜŞTERİYE DAMPING KAZANCI"
                value={`${tr(b?.dampingEarnedCents ?? 0)} ₺`}
                visible={!!b && b.dampingEarnedCents > 0}
                tone="amber"
              />
              {done ? (
                <ReceiptLine label="KALAN DAMPING HANE" value={`${tr(done.remaining)} ₺`} visible tone="amber" />
              ) : null}
            </div>

            <div className="dashed-rule my-4" />

            <p className="text-center text-[0.62rem] leading-relaxed text-sicak-gri">
              Ödeme işletmeye yapılmıştır. Damping Hane nakit değildir, çekilemez.
              <br />
              Bu belge DampingVar tarafından doğrulanmıştır.
            </p>

            {done ? (
              <div className="mt-5 flex justify-center">
                <span className="stamp anim-stamp border-[3px] px-5 py-2 font-display text-[0.82rem] font-bold">
                  Ödeme alındı
                </span>
              </div>
            ) : null}
          </div>
          <div className="perforated-bottom h-3 w-full" />
        </div>

        <p className="mx-auto mt-5 max-w-[380px] text-center text-[0.72rem] leading-relaxed text-sicak-gri">
          Fiyatlandırma, komisyon, havuz katkısı ve Damping Hane hareketleri sunucuda hesaplanır. Yarım kalan
          işlem hiçbir kaydı değiştirmez.
        </p>
      </aside>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[0.62rem] uppercase tracking-[0.14em] text-sicak-gri">{label}</span>
      <span className={`tabular text-right text-[0.76rem] ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function ReceiptLine({
  label,
  value,
  visible,
  tone = "ink",
}: {
  label: string;
  value: string;
  visible: boolean;
  tone?: "ink" | "damping" | "amber";
}) {
  if (!visible) return null;
  const color = tone === "damping" ? "text-damping" : tone === "amber" ? "text-[#a1720b]" : "text-murekkep";
  return (
    <div key={label} className="anim-print flex items-baseline justify-between gap-3">
      <span className={`text-[0.66rem] uppercase tracking-[0.11em] ${color}`}>{label}</span>
      <span className={`tabular text-[0.92rem] font-semibold ${color}`}>{value}</span>
    </div>
  );
}

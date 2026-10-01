import Link from "next/link";

/* ----------------------------- MARKA İŞARETİ ----------------------------- *
 * Elle çizilmiş vektör: damperli fiyat etiketi + "D" monogramı.
 * 16px'te de okunur, tek renkte de çalışır.
 * ------------------------------------------------------------------------ */
export function DampingMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="DampingVar"
    >
      <path
        d="M7 3h26.2a3 3 0 0 1 2.12.88l10.8 10.8A3 3 0 0 1 47 16.8V41a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z"
        fill="currentColor"
      />
      <path d="M33.2 3.4V13a3 3 0 0 0 3 3h9.6" stroke="var(--color-kagit)" strokeWidth="2.4" fill="none" />
      <path
        d="M14 16h8.6c6.2 0 11.2 4.9 11.2 11S28.8 38 22.6 38H14V16Z"
        fill="var(--color-kagit)"
      />
      <path
        d="M20 21.4h2.9c3.1 0 5.6 2.5 5.6 5.6s-2.5 5.6-5.6 5.6H20v-11.2Z"
        fill="currentColor"
      />
      <circle cx="38.4" cy="35.6" r="3.2" fill="var(--color-kagit)" />
    </svg>
  );
}

export function Logo({ light = false, size = 38 }: { light?: boolean; size?: number }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="DampingVar ana sayfa">
      <span className={light ? "text-kagit" : "text-damping"}>
        <DampingMark size={size} />
      </span>
      <span
        className={`font-display text-[1.35rem] font-extrabold leading-none tracking-[-0.02em] ${
          light ? "text-kagit" : "text-murekkep"
        }`}
      >
        Damping<span className="text-damping">Var</span>
      </span>
    </Link>
  );
}

/* ------------------------------- MÜHÜR ---------------------------------- */
export function Stamp({
  children,
  tone = "damping",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "damping" | "murekkep" | "amber";
  className?: string;
}) {
  const color =
    tone === "murekkep"
      ? "border-murekkep text-murekkep"
      : tone === "amber"
        ? "border-amber text-amber"
        : "border-damping text-damping";
  return (
    <span
      className={`stamp anim-stamp inline-block px-3 py-1.5 font-display text-[0.62rem] font-bold ${color} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------------------------- BÖLÜM BAŞLIKLARI --------------------------- */
export function SectionTitle({
  eyebrow,
  title,
  note,
  action,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b-2 border-murekkep pb-4">
      <div className="max-w-2xl">
        <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-damping">{eyebrow}</p>
        <h2 className="font-display text-[clamp(1.75rem,3.4vw,2.65rem)] font-extrabold leading-[1.02] tracking-[-0.025em]">
          {title}
        </h2>
        {note ? <p className="mt-2.5 max-w-xl text-[0.95rem] leading-relaxed text-murekkep-soft">{note}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- PUAN ---------------------------------- */
export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true" className="text-damping">
        <path
          d="M10 1.6l2.47 5.28 5.53.72-4.06 3.87 1.05 5.73L10 14.5l-4.99 2.7 1.05-5.73L2 7.6l5.53-.72L10 1.6z"
          fill="currentColor"
        />
      </svg>
      <span className="tabular text-[0.82rem] font-semibold">{value.toFixed(1)}</span>
      {typeof count === "number" ? (
        <span className="text-[0.78rem] text-sicak-gri">({count} yorum)</span>
      ) : null}
    </span>
  );
}

/* ------------------------------- DURUM ETİKETİ --------------------------- */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "damping" | "ink" | "amber" | "green";
}) {
  const map = {
    neutral: "bg-kagit-2 text-murekkep-soft border-murekkep/15",
    damping: "bg-damping text-kagit border-damping",
    ink: "bg-murekkep text-kagit border-murekkep",
    amber: "bg-amber/20 text-damping-dark border-amber/50",
    green: "bg-[#1f6f4a] text-kagit border-[#1f6f4a]",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${map[tone]}`}
    >
      {children}
    </span>
  );
}

/* --------------------------------- BUTON -------------------------------- */
export function Btn({
  href,
  children,
  variant = "primary",
  className = "",
  type,
  onClick,
  disabled,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "ink" | "outline" | "ghost";
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-5 py-3 font-sans text-[0.82rem] font-semibold uppercase tracking-[0.13em] transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-damping text-kagit hover:bg-damping-dark shadow-[3px_3px_0_0_rgba(18,33,47,0.9)] hover:shadow-[1px_1px_0_0_rgba(18,33,47,0.9)] hover:translate-x-[2px] hover:translate-y-[2px]",
    ink: "bg-murekkep text-kagit hover:bg-murekkep-soft",
    outline: "border-2 border-murekkep text-murekkep hover:bg-murekkep hover:text-kagit",
    ghost: "text-murekkep-soft hover:text-damping underline underline-offset-4 decoration-damping/40",
  } as const;
  const cls = `${base} ${styles[variant]} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

/* ------------------------------- İSTATİSTİK ------------------------------ */
export function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`anim-rise border-2 p-5 ${
        accent ? "border-damping bg-damping-soft/50" : "border-murekkep/12 bg-white/55"
      }`}
    >
      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-sicak-gri">{label}</p>
      <p className={`tabular mt-2.5 text-[1.65rem] font-semibold leading-none ${accent ? "text-damping-dark" : ""}`}>
        {value}
      </p>
      {sub ? <p className="mt-2 text-[0.76rem] leading-snug text-murekkep-soft">{sub}</p> : null}
    </div>
  );
}

/* --------------------------------- HARİTA -------------------------------- */
export function MapSketch({ district, city }: { district: string; city: string }) {
  return (
    <div className="relative overflow-hidden border-2 border-murekkep/15 bg-kagit-2">
      <svg viewBox="0 0 480 260" className="h-full w-full" role="img" aria-label={`${district} krokisi`}>
        <rect width="480" height="260" fill="#efe7d8" />
        <g stroke="#12212f" strokeOpacity="0.12" strokeWidth="1">
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 26} x2="480" y2={i * 26} />
          ))}
          {Array.from({ length: 16 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 30} y1="0" x2={i * 30} y2="260" />
          ))}
        </g>
        <path d="M0 168 C 90 150, 150 196, 230 178 S 380 140, 480 158" stroke="#12212f" strokeOpacity="0.45" strokeWidth="9" fill="none" />
        <path d="M120 0 L 138 260" stroke="#12212f" strokeOpacity="0.3" strokeWidth="6" fill="none" />
        <path d="M330 0 L 312 260" stroke="#12212f" strokeOpacity="0.3" strokeWidth="6" fill="none" />
        <circle cx="228" cy="128" r="26" fill="#d6362b" fillOpacity="0.16" />
        <path d="M228 100c-11 0-20 9-20 20 0 15 20 34 20 34s20-19 20-34c0-11-9-20-20-20z" fill="#d6362b" />
        <circle cx="228" cy="120" r="7" fill="#f7f2e8" />
      </svg>
      <div className="absolute bottom-3 left-3 border border-murekkep/20 bg-kagit/90 px-3 py-1.5">
        <p className="text-[0.7rem] font-semibold">{district}</p>
        <p className="text-[0.62rem] text-sicak-gri">{city}</p>
      </div>
    </div>
  );
}

/* ------------------------------- GRAFİK ÇİZİMİ --------------------------- */
export function BarChart({
  data,
  labels,
  height = 150,
  accentIndex,
}: {
  data: number[];
  labels: string[];
  height?: number;
  accentIndex?: number;
}) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
          <div
            className={`w-full transition-colors duration-200 ${
              accentIndex === i ? "bg-damping" : "bg-murekkep/25 group-hover:bg-damping/70"
            }`}
            style={{ height: `${Math.max(3, (v / max) * (height - 22))}px` }}
            title={`${labels[i]}: ${v}`}
          />
          <span className="mt-1.5 text-[0.55rem] text-sicak-gri">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ data, color = "#d6362b" }: { data: number[]; color?: string }) {
  const max = Math.max(1, ...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${40 - (v / max) * 36}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-12 w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <polyline points={`0,40 ${pts} 100,40`} fill={color} fillOpacity="0.1" stroke="none" />
    </svg>
  );
}

/* ------------------------------- KASA FİŞİ KABUK ------------------------- */
export function ReceiptShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="perforated-top h-3 w-full bg-transparent" />
      <div className="bg-kagit px-6 pb-2 pt-1 shadow-[0_18px_50px_rgba(18,33,47,0.14)]">{children}</div>
      <div className="perforated-bottom h-3 w-full bg-transparent" />
    </div>
  );
}

const trCurrency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

const trNumber = new Intl.NumberFormat("tr-TR");

/** Kuruş -> "₺340,00" */
export function fmtTL(cents: number): string {
  return trCurrency.format((cents ?? 0) / 100);
}

/** Kuruş -> "340,00" (para birimi sembolü olmadan) */
export function fmtNum(cents: number): string {
  return trNumber.format(Math.round((cents ?? 0) / 100));
}

export function fmtInt(n: number): string {
  return trNumber.format(Math.round(n ?? 0));
}

export function fmtPercent(rate: number, digits = 0): string {
  return `%${(rate * 100).toFixed(digits)}`;
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function fmtDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function fmtTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const DAY_NAMES = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

export type HourRow = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
};

/** Şu an işletme açık mı? */
export function isOpenNow(hours: HourRow[], now = new Date()): boolean {
  const row = hours.find((h) => h.dayOfWeek === now.getDay());
  if (!row || row.closed) return false;
  const [oh, om] = row.opensAt.split(":").map(Number);
  const [ch, cm] = row.closesAt.split(":").map(Number);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = oh * 60 + om;
  let close = ch * 60 + cm;
  if (close <= open) close += 24 * 60;
  const m = minutes < open ? minutes + 24 * 60 : minutes;
  return m >= open && m <= close;
}

export function openLabel(hours: HourRow[], now = new Date()): string {
  return isOpenNow(hours, now) ? "Açık" : "Kapalı";
}

export function slugify(input: string): string {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    İ: "i",
    Ç: "c",
    Ğ: "g",
    Ö: "o",
    Ş: "s",
    Ü: "u",
  };
  return input
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

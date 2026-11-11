/**
 * Provably fair üretici.
 * float_i = HMAC_SHA256(server_seed, `${client_seed}:${nonce}:${cursor}`) baytlarından türetilir.
 * Round başında yalnızca sha256(server_seed) gösterilir; seed rotasyonunda eski seed açıklanır.
 */
import { createHash, createHmac, randomBytes } from "crypto";

export const newSeed = () => randomBytes(32).toString("hex");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function floats(serverSeed: string, clientSeed: string, nonce: number, count: number): number[] {
  const out: number[] = [];
  let cursor = 0;
  while (out.length < count) {
    const buf = createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}:${cursor}`).digest();
    for (let i = 0; i + 4 <= buf.length && out.length < count; i += 4) {
      out.push(buf[i] / 256 + buf[i + 1] / 256 ** 2 + buf[i + 2] / 256 ** 3 + buf[i + 3] / 256 ** 4);
    }
    cursor++;
  }
  return out;
}

/** Fisher–Yates ile [0..n) dizisinden ilk k elemanı karıştırarak seçer. */
export function shuffle(n: number, fl: number[]): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < n - 1 && i < fl.length; i++) {
    const j = i + Math.floor(fl[i] * (n - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- Oyun sonuçları (hem oyun hem doğrulama sayfası aynı fonksiyonları kullanır) ----
export const dice = (f: number) => Math.floor(f * 10001) / 100; // 0.00–100.00
export const mines = (fl: number[], count: number) => shuffle(25, fl).slice(0, count).sort((a, b) => a - b);
export const keno = (fl: number[]) => shuffle(40, fl).slice(0, 10).map((x) => x + 1).sort((a, b) => a - b);
/** 52 kartlık deste sırası (0..51) → rank = c%13, suit = floor(c/13) */
export const deck = (fl: number[]) => shuffle(52, fl);

export const HOUSE_EDGE = 0.01;

export function minesMultiplier(minesCount: number, revealed: number) {
  let m = 1;
  for (let i = 0; i < revealed; i++) m *= (25 - i) / (25 - minesCount - i);
  return Math.floor(m * (1 - HOUSE_EDGE) * 100) / 100;
}

/** Keno ödeme tablosu: [seçilen sayı adedi][isabet] → çarpan */
export const KENO_PAYTABLE: Record<number, number[]> = {
  1: [0, 3.8], 2: [0, 1.7, 5.2], 3: [0, 0, 2.7, 48], 4: [0, 0, 1.7, 10, 84],
  5: [0, 0, 1.4, 4, 14, 390], 6: [0, 0, 0, 3, 9, 180, 710], 7: [0, 0, 0, 2, 7, 30, 400, 800],
  8: [0, 0, 0, 2, 4, 11, 67, 400, 900], 9: [0, 0, 0, 2, 2.5, 5, 15, 100, 500, 1000],
  10: [0, 0, 0, 1.6, 2, 4, 7, 26, 100, 500, 1000],
};

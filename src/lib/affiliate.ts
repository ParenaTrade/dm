/** Affiliate yardımcıları */

export function safeHttpUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withProto);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** {click_id} / {clickid} yer tutucusu varsa onu doldurur, yoksa parametre olarak ekler. */
export function buildAffiliateUrl(url: string, clickParam: string, clickId: string): string {
  if (/\{click_?id\}/i.test(url)) return url.replace(/\{click_?id\}/gi, encodeURIComponent(clickId));
  try {
    const u = new URL(url);
    u.searchParams.set((clickParam || "subid").trim() || "subid", clickId);
    return u.toString();
  } catch {
    return url;
  }
}

/** "Maç Yorumu" -> "mac", "Oyun" -> "oyun" ... yayın kategorisini reklam yerleşimiyle eşleştirir. */
export function placementKey(category: string | null | undefined): string {
  const c = (category ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
  if (c.includes("mac") || c.includes("spor")) return "mac";
  if (c.includes("oyun")) return "oyun";
  if (c.includes("sohbet") || c.includes("konuk") || c.includes("eglence")) return "sohbet";
  return "all";
}

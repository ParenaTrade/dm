/** Reklam / iş ortaklığı uyarısı: bonus ve affiliate içeren her sayfada gösterilir. */
export function Disclosure({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`${compact ? "text-[10px]" : "text-xs"} leading-relaxed text-white/45`}>
      <span className="mr-1.5 rounded border border-white/25 px-1 py-0.5 font-bold text-white/70">18+</span>
      Reklam / iş ortaklığı bağlantısıdır. Bonus şartları ilgili siteye göre değişir, kampanya şartlarını mutlaka
      okuyun. Kumar bağımlılık yapabilir; sorumlu oyna. Bulunduğun ülkenin yasalarına uymak sana aittir.
    </p>
  );
}

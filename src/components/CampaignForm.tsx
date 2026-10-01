"use client";

import { useState } from "react";

const TYPES = [
  ["PERCENT", "Yüzde indirim"],
  ["FIXED", "Sabit tutar avantajı"],
  ["PRODUCT", "Ürün kampanyası"],
  ["HOUR", "Saat kampanyası"],
  ["DAY", "Gün kampanyası"],
  ["FIRST", "İlk alışveriş"],
  ["RETURN", "Tekrar alışveriş"],
  ["QR_ONLY", "QR özel kampanya"],
];

export default function CampaignForm({
  businessId,
  actorEmail,
  allowed,
  slug,
}: {
  businessId: string;
  actorEmail: string;
  allowed: boolean;
  slug: string;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "PERCENT",
    discountPercent: 15,
    discountAmountCents: 0,
    minBasketCents: 0,
    maxDiscountCents: 0,
    usageLimit: 100,
    perCustomerLimit: 1,
    timeStart: "",
    timeEnd: "",
  });
  const [days, setDays] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessId,
        actorEmail,
        ...form,
        discountPercent: Number(form.discountPercent),
        discountAmountCents: Number(form.discountAmountCents) * 100,
        minBasketCents: Number(form.minBasketCents) * 100,
        maxDiscountCents: Number(form.maxDiscountCents) * 100,
        usageLimit: Number(form.usageLimit),
        days,
      }),
    });
    const data = await res.json();
    setMsg(data.ok ? "Kampanya oluşturuldu ve yayınlandı." : (data.error ?? "Hata oluştu."));
    setLoading(false);
    if (data.ok) setTimeout(() => window.location.reload(), 900);
  }

  async function aiSuggest() {
    setAiBusy(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, action: "kampanya", actorEmail, goal: "Bu hafta müşteri sayısını artırmak istiyorum." }),
    });
    const data = await res.json();
    if (data.suggestion) {
      setForm((f) => ({
        ...f,
        title: data.suggestion.title,
        description: data.suggestion.description,
        discountPercent: data.suggestion.discountPercent,
        minBasketCents: Math.round(data.suggestion.minBasketCents / 100),
        maxDiscountCents: Math.round(data.suggestion.maxDiscountCents / 100),
        timeStart: data.suggestion.timeStart ?? "",
        timeEnd: data.suggestion.timeEnd ?? "",
      }));
      setDays(data.suggestion.days ?? []);
      setMsg("AI önerisi forma uygulandı. Değerleri kontrol edip onaylayın.");
    } else {
      setMsg(data.error ?? "AI önerisi alınamadı.");
    }
    setAiBusy(false);
  }

  return (
    <form onSubmit={submit} className="border-2 border-murekkep/12 bg-white/55">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-murekkep/12 px-6 py-4">
        <div>
          <h2 className="font-display text-[1.18rem] font-bold">Yeni kampanya</h2>
          <p className="mt-1.5 text-[0.82rem] text-murekkep-soft">
            Finansal oranlar sunucuda doğrulanır; kasiyer rolü kampanya kuralı değiştiremez.
          </p>
        </div>
        <button
          type="button"
          onClick={aiSuggest}
          disabled={!allowed || aiBusy}
          className="border-2 border-damping px-4 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-damping hover:bg-damping hover:text-kagit disabled:opacity-45"
        >
          {aiBusy ? "AI hazırlanıyor…" : "✦ AI önerisi al"}
        </button>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Kampanya adı</span>
          <input
            required
            value={form.title}
            onChange={set("title")}
            placeholder="Örn. Akşam Saatlerinde %15 Damping"
            className="mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Açıklama</span>
          <textarea
            value={form.description}
            onChange={set("description")}
            rows={3}
            placeholder="Kampanya koşullarını açık ve net yazın."
            className="mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] leading-relaxed focus:border-damping focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Kampanya türü</span>
          <select
            value={form.type}
            onChange={set("type")}
            className="mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none"
          >
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">İndirim oranı (%)</span>
          <input
            type="number"
            min={0}
            max={60}
            value={form.discountPercent}
            onChange={set("discountPercent")}
            className="tabular mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Sabit indirim (TL)</span>
          <input
            type="number"
            min={0}
            value={form.discountAmountCents}
            onChange={set("discountAmountCents")}
            className="tabular mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Minimum sepet (TL)</span>
          <input
            type="number"
            min={0}
            value={form.minBasketCents}
            onChange={set("minBasketCents")}
            className="tabular mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Maksimum indirim (TL)</span>
          <input
            type="number"
            min={0}
            value={form.maxDiscountCents}
            onChange={set("maxDiscountCents")}
            className="tabular mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Kullanım limiti</span>
          <input
            type="number"
            min={1}
            value={form.usageLimit}
            onChange={set("usageLimit")}
            className="tabular mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">
            Müşteri başına kullanım
          </span>
          <input
            type="number"
            min={1}
            value={form.perCustomerLimit}
            onChange={set("perCustomerLimit")}
            className="tabular mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Başlangıç saati</span>
          <input
            type="time"
            value={form.timeStart}
            onChange={set("timeStart")}
            className="tabular mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Bitiş saati</span>
          <input
            type="time"
            value={form.timeEnd}
            onChange={set("timeEnd")}
            className="tabular mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none"
          />
        </label>

        <div className="md:col-span-2">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Geçerli günler</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"].map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
                className={`border-2 px-3.5 py-2 text-[0.74rem] font-semibold ${
                  days.includes(i) ? "border-damping bg-damping text-kagit" : "border-murekkep/15 text-murekkep-soft"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[0.72rem] text-sicak-gri">Hiçbir gün seçilmezse kampanya her gün geçerlidir.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t-2 border-murekkep/12 px-6 py-4">
        <button
          type="submit"
          disabled={!allowed || loading}
          className="border-2 border-damping bg-damping px-6 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.13em] text-kagit hover:bg-damping-dark disabled:opacity-45"
        >
          {loading ? "Oluşturuluyor…" : "Kampanyayı yayınla"}
        </button>
        {!allowed ? <p className="text-[0.78rem] text-damping">Bu rol kampanya oluşturamaz.</p> : null}
        {msg ? <p className="text-[0.82rem] text-murekkep-soft">{msg}</p> : null}
      </div>
    </form>
  );
}

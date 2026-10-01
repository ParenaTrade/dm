"use client";

import { useState } from "react";

type Biz = {
  id: string;
  name: string;
  description: string | null;
  story: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  address: string;
  subCategory: string | null;
};

export default function ProfileForm({
  business,
  actorEmail,
  canEdit,
}: {
  business: Biz;
  actorEmail: string;
  canEdit: boolean;
}) {
  const [form, setForm] = useState({
    name: business.name,
    description: business.description ?? "",
    story: business.story ?? "",
    phone: business.phone ?? "",
    whatsapp: business.whatsapp ?? "",
    instagram: business.instagram ?? "",
    website: business.website ?? "",
    address: business.address,
    subCategory: business.subCategory ?? "",
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    const res = await fetch("/api/business", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId: business.id, actorEmail, ...form }),
    });
    const data = await res.json();
    if (data.ok) {
      setState("saved");
      setMsg("İşletme bilgileri kaydedildi. Dijital vitrin anında güncellendi.");
    } else {
      setState("error");
      setMsg(data.error ?? "Kaydetme sırasında hata oluştu.");
    }
    setTimeout(() => setState("idle"), 3200);
  }

  return (
    <form onSubmit={save} className="border-2 border-murekkep/12 bg-white/55">
      <div className="border-b-2 border-murekkep/12 px-6 py-4">
        <h2 className="font-display text-[1.18rem] font-bold">İşletme profili</h2>
        <p className="mt-1.5 text-[0.82rem] text-murekkep-soft">
          Bu alanlar dijital vitrinde, arama motorlarında ve AI içerik üretiminde kullanılır.
        </p>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        {[
          ["name", "İşletme adı"],
          ["subCategory", "Alt kategori"],
          ["phone", "Telefon"],
          ["whatsapp", "WhatsApp"],
          ["instagram", "Instagram"],
          ["website", "Web sitesi"],
        ].map(([key, label]) => (
          <label key={key} className="block">
            <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">{label}</span>
            <input
              value={form[key as keyof typeof form]}
              onChange={set(key as keyof typeof form)}
              disabled={!canEdit}
              className="mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none disabled:opacity-60"
            />
          </label>
        ))}

        <label className="block md:col-span-2">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Adres</span>
          <input
            value={form.address}
            onChange={set("address")}
            disabled={!canEdit}
            className="mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] focus:border-damping focus:outline-none disabled:opacity-60"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">Açıklama</span>
          <textarea
            value={form.description}
            onChange={set("description")}
            rows={3}
            disabled={!canEdit}
            className="mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] leading-relaxed focus:border-damping focus:outline-none disabled:opacity-60"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-sicak-gri">
            İşletme hikâyesi
          </span>
          <textarea
            value={form.story}
            onChange={set("story")}
            rows={3}
            disabled={!canEdit}
            className="mt-1.5 w-full border-2 border-murekkep/15 bg-kagit px-3.5 py-2.5 text-[0.9rem] leading-relaxed focus:border-damping focus:outline-none disabled:opacity-60"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t-2 border-murekkep/12 px-6 py-4">
        <button
          type="submit"
          disabled={!canEdit || state === "saving"}
          className="border-2 border-damping bg-damping px-6 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.13em] text-kagit hover:bg-damping-dark disabled:opacity-45"
        >
          {state === "saving" ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </button>
        {!canEdit ? (
          <p className="text-[0.78rem] text-damping">
            Kasiyer rolü işletme bilgilerini değiştiremez.
          </p>
        ) : null}
        {msg ? (
          <p className={`text-[0.8rem] ${state === "error" ? "text-damping" : "text-[#1f6f4a]"}`}>{msg}</p>
        ) : null}
      </div>
    </form>
  );
}

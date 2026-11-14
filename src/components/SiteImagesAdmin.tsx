"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Slot = { slot: string; label: string; hint: string; url: string | null; updatedAt: string | null };

/** Büyük fotoğrafları yüklemeden önce küçült (Vercel istek sınırı ~4,5 MB). */
async function shrink(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 700_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" && file.size < 3_000_000 ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
    if (blob && blob.size < file.size) {
      return new File([blob], file.name.replace(/\.\w+$/, type === "image/png" ? ".png" : ".jpg"), { type });
    }
  } catch {
    /* orijinal dosya kullanılır */
  }
  return file;
}

export function SiteImagesAdmin() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [storageReady, setStorageReady] = useState(true);
  const [bucket, setBucket] = useState("images");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const targetSlot = useRef<string>("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/images", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!data?.ok) return;
    setSlots(data.slots);
    setCanEdit(Boolean(data.canEdit));
    setStorageReady(Boolean(data.storageReady));
    setBucket(data.bucket);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pick = (slot: string) => {
    targetSlot.current = slot;
    fileInput.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const slot = targetSlot.current;
    if (!file || !slot) return;
    setMessage(null);
    setBusy(slot);
    const prepared = await shrink(file);
    const form = new FormData();
    form.append("slot", slot);
    form.append("file", prepared);
    const res = await fetch("/api/images", { method: "POST", body: form });
    const data = await res.json().catch(() => ({ ok: false, error: "Sunucu yanıt vermedi (dosya çok büyük olabilir)." }));
    setBusy(null);
    if (fileInput.current) fileInput.current.value = "";
    setMessage({ ok: Boolean(data.ok), text: data.ok ? "Görsel kaydedildi. Ana sayfada birkaç saniye içinde görünür." : data.error });
    if (data.ok) await load();
  };

  const remove = async (slot: string) => {
    if (!confirm("Bu görsel silinsin mi?")) return;
    setMessage(null);
    setBusy(slot);
    const res = await fetch(`/api/images?slot=${encodeURIComponent(slot)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({ ok: false, error: "Silinemedi" }));
    setBusy(null);
    setMessage({ ok: Boolean(data.ok), text: data.ok ? "Görsel silindi." : data.error });
    if (data.ok) await load();
  };

  return (
    <div className="space-y-4">
      <div className="glass-dark rounded-2xl p-4 text-sm text-white/70">
        Ana sayfa görselleri Supabase Storage <span className="font-mono text-gold">{bucket}</span> kovasındaki{" "}
        <span className="font-mono text-gold">site/</span> klasöründe tutulur. {canEdit ? "Ekle, değiştir veya sil." : "Düzenleme yalnızca admin içindir."}
      </div>
      {!storageReady && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
          Yükleme için Vercel ortam değişkenlerine <b>SUPABASE_SERVICE_ROLE_KEY</b> eklemelisin (Supabase → Project Settings → API → service_role).
        </p>
      )}
      {message && (
        <p className={`rounded-xl border p-3 text-sm ${message.ok ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-red-400/40 bg-red-400/10 text-red-200"}`}>
          {message.text}
        </p>
      )}

      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((s) => (
          <div key={s.slot} className="glass-dark overflow-hidden rounded-2xl">
            <div className="relative flex aspect-video items-center justify-center bg-black/50">
              {s.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt={s.label} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-white/35">Görsel yok</span>
              )}
              {busy === s.slot && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm font-bold text-gold">İşleniyor…</div>
              )}
            </div>
            <div className="space-y-2 p-4">
              <p className="font-bold">{s.label}</p>
              <p className="text-xs text-white/45">{s.hint}</p>
              {canEdit && (
                <div className="flex gap-2 pt-1">
                  <button disabled={busy !== null || !storageReady} onClick={() => pick(s.slot)} className="btn-gold flex-1 rounded-xl py-2 text-sm font-bold disabled:opacity-50">
                    {s.url ? "Değiştir" : "Ekle"}
                  </button>
                  {s.url && (
                    <button disabled={busy !== null} onClick={() => void remove(s.slot)} className="rounded-xl bg-red-600/80 px-4 py-2 text-sm font-bold hover:bg-red-500 disabled:opacity-50">
                      Sil
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

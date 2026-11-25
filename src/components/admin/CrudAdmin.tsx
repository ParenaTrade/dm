"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "checkbox" | "select" | "datetime" | "image" | "sponsor";
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
};

export type CrudConfig = {
  title: string;
  hint?: string;
  endpoint: string;
  /** GET sorgu eki, ör. "?kind=promo" */
  query?: string;
  /** POST/PUT gövdesine eklenen sabit alanlar, ör. { kind: "promo" } */
  extra?: Record<string, unknown>;
  /** Listede başlık / alt başlık / görsel alanları */
  titleKey: string;
  subtitleKey?: string;
  imageKey?: string;
  badgeKey?: string;
  fields: Field[];
  defaults: Record<string, unknown>;
};

type Row = Record<string, unknown> & { id: number };

/** Saat alanı Türkiye saatiyle girilir/gösterilir (site de Türkiye saatiyle gösterir). */
const toIso = (local: string) => (local ? new Date(`${local}:00+03:00`).toISOString() : null);
const fromIso = (iso: unknown) => {
  if (typeof iso !== "string" || !iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
};

export function CrudAdmin({ config }: { config: CrudConfig }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [sponsors, setSponsors] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadKey = useRef<string>("");

  const needsSponsors = config.fields.some((f) => f.type === "sponsor");

  const load = useCallback(async () => {
    const res = await fetch(`${config.endpoint}${config.query ?? ""}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (data.ok) setRows((data.items ?? data.sponsors ?? []) as Row[]);
    if (needsSponsors) {
      const sp = await fetch("/api/sponsors", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (sp.ok) setSponsors((sp.sponsors as { id: number; name: string }[]).map((s) => ({ id: s.id, name: s.name })));
    }
  }, [config.endpoint, config.query, needsSponsors]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const startNew = () => {
    setErr(null);
    setMsg(null);
    setForm({ ...config.defaults });
  };
  const startEdit = (row: Row) => {
    setErr(null);
    setMsg(null);
    const next: Record<string, unknown> = { id: row.id };
    for (const f of config.fields) {
      const v = row[f.key];
      next[f.key] = f.type === "datetime" ? fromIso(v) : (v ?? (f.type === "checkbox" ? false : ""));
    }
    setForm(next);
  };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = { ...config.extra };
    if (form.id) body.id = form.id;
    for (const f of config.fields) {
      let v = form[f.key];
      if (f.type === "datetime") v = toIso(String(v ?? ""));
      if (f.type === "number") v = Number(v) || 0;
      if (f.type === "sponsor") v = v ? Number(v) : null;
      body[f.key] = v;
    }
    const res = await fetch(config.endpoint, {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!data.ok) {
      setErr(data.error ?? "Kaydedilemedi");
      return;
    }
    setForm(null);
    setMsg(form.id ? "Güncellendi ✓" : "Eklendi ✓");
    await load();
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`"${String(row[config.titleKey])}" silinsin mi?`)) return;
    const res = await fetch(`${config.endpoint}?id=${row.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setMsg(data.ok ? "Silindi ✓" : (data.error ?? "Silinemedi"));
    await load();
  };

  const toggleActive = async (row: Row) => {
    await fetch(config.endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, active: !row.active }),
    });
    await load();
  };

  const upload = async (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      setErr(data.error ?? "Yüklenemedi");
      return;
    }
    setForm((f) => (f ? { ...f, [uploadKey.current]: data.url } : f));
  };

  const input = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-gold/50";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-gold">{config.title}</h3>
          {config.hint && <p className="text-sm text-white/50">{config.hint}</p>}
        </div>
        <button onClick={startNew} className="btn-gold rounded-full px-5 py-2 text-sm font-bold">
          + Yeni ekle
        </button>
      </div>

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-goldsoft">{msg}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />

      {form && (
        <div className="glass-dark space-y-3 rounded-2xl p-4">
          <p className="text-sm font-semibold">{form.id ? "Düzenle" : "Yeni kayıt"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.fields.map((f) => {
              const val = form[f.key];
              const set = (v: unknown) => setForm({ ...form, [f.key]: v });
              const wide = f.wide || f.type === "textarea" || f.type === "image";
              return (
                <label key={f.key} className={`text-xs text-white/60 ${wide ? "sm:col-span-2" : ""}`}>
                  {f.label}
                  {f.required ? " *" : ""}
                  {f.type === "textarea" ? (
                    <textarea
                      value={String(val ?? "")}
                      onChange={(e) => set(e.target.value)}
                      rows={3}
                      placeholder={f.placeholder}
                      className={`mt-1 ${input}`}
                    />
                  ) : f.type === "checkbox" ? (
                    <span className="mt-2 flex items-center gap-2 text-sm text-white">
                      <input type="checkbox" checked={Boolean(val)} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-amber-400" />
                      Evet
                    </span>
                  ) : f.type === "select" ? (
                    <select value={String(val ?? "")} onChange={(e) => set(e.target.value)} className={`mt-1 ${input}`}>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "sponsor" ? (
                    <select value={String(val ?? "")} onChange={(e) => set(e.target.value)} className={`mt-1 ${input}`}>
                      <option value="">— Sponsor seç —</option>
                      {sponsors.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "image" ? (
                    <span className="mt-1 flex items-center gap-2">
                      {typeof val === "string" && val && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={val} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-white/90 object-contain p-0.5" />
                      )}
                      <input
                        value={String(val ?? "")}
                        onChange={(e) => set(e.target.value)}
                        placeholder={f.placeholder ?? "https://... görsel adresi"}
                        className={input}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          uploadKey.current = f.key;
                          fileRef.current?.click();
                        }}
                        className="btn-ghost shrink-0 rounded-xl px-3 py-2.5 text-sm"
                      >
                        Yükle
                      </button>
                    </span>
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"}
                      value={String(val ?? "")}
                      onChange={(e) => set(e.target.value)}
                      placeholder={f.placeholder}
                      className={`mt-1 ${input}`}
                    />
                  )}
                  {f.hint && <span className="mt-1 block text-[11px] text-white/35">{f.hint}</span>}
                </label>
              );
            })}
          </div>
          {err && <p className="text-sm text-red-300">{err}</p>}
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => void save()} className="btn-gold rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-50">
              {busy ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button onClick={() => setForm(null)} className="btn-ghost rounded-xl px-5 py-2 text-sm">
              Vazgeç
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-white/40">Henüz kayıt yok.</p>}
        {rows.map((row) => {
          const img = config.imageKey ? String(row[config.imageKey] ?? "") : "";
          return (
            <div key={row.id} className="glass-dark flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
              {config.imageKey && (
                // eslint-disable-next-line @next/next/no-img-element
                img ? <img src={img} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-white/90 object-contain p-0.5" /> : <span className="h-11 w-11 shrink-0 rounded-lg bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {String(row[config.titleKey] ?? "")}
                  {config.badgeKey && row[config.badgeKey] ? (
                    <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">{String(row[config.badgeKey])}</span>
                  ) : null}
                </p>
                {config.subtitleKey && <p className="truncate text-xs text-white/45">{String(row[config.subtitleKey] ?? "")}</p>}
              </div>
              {"active" in row && (
                <button
                  onClick={() => void toggleActive(row)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${row.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50"}`}
                >
                  {row.active ? "Yayında" : "Gizli"}
                </button>
              )}
              <button onClick={() => startEdit(row)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
                Düzenle
              </button>
              <button onClick={() => void remove(row)} className="rounded-lg bg-red-500/25 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/45">
                Sil
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Megaphone,
  Target,
  Share2,
  Clapperboard,
  CalendarDays,
  BarChart3,
  Lightbulb,
  Loader2,
  Check,
  X,
  Pencil,
  Trash2,
  Sparkles,
} from "lucide-react";

const ACTIONS = [
  { key: "reklam", icon: Megaphone, label: "Reklam hazırla", desc: "5 farklı reklam varyasyonu" },
  { key: "kampanya", icon: Target, label: "Kampanya oluştur", desc: "Verilerine göre indirim önerisi" },
  { key: "sosyal", icon: Share2, label: "Sosyal medya paylaşımı", desc: "Instagram / Facebook / WhatsApp" },
  { key: "story", icon: Share2, label: "Story metni", desc: "4 kareli story akışı" },
  { key: "video", icon: Clapperboard, label: "Video hazırla", desc: "15 saniyelik senaryo" },
  { key: "plan", icon: CalendarDays, label: "28 günlük plan", desc: "Sektörüne özel içerik takvimi" },
  { key: "analiz", icon: BarChart3, label: "Performansımı analiz et", desc: "Gerçek sistem verilerinden" },
  { key: "rapor", icon: Lightbulb, label: "Haftalık büyüme raporu", desc: "AI özeti ve öneriler" },
];

type ContentRow = {
  id: string;
  kind: string;
  platform: string | null;
  title: string;
  body: string;
  cta: string | null;
  variant: string | null;
  status: string;
  createdAt: string;
};

const STATUS_TR: Record<string, string> = {
  DRAFT: "AI tarafından hazırlandı",
  APPROVED: "Onaylandı",
  PUBLISHED: "Yayında",
  REJECTED: "Reddedildi",
};

export default function AiStudio({
  slug,
  actorEmail,
  canApprove,
  existing,
}: {
  slug: string;
  actorEmail: string;
  canApprove: boolean;
  existing: ContentRow[];
}) {
  const [goal, setGoal] = useState("Bu hafta müşteri sayısını artırmak istiyorum.");
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<ContentRow[]>(existing);
  const [bullets, setBullets] = useState<string[]>([]);
  const [flash, setFlash] = useState("");

  async function run(action: string) {
    setBusy(action);
    setFlash("");
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, action, actorEmail, goal, platform: "Instagram" }),
    });
    const data = await res.json();
    if (!data.ok) {
      setFlash(data.error ?? "Üretim sırasında hata oluştu.");
      setBusy(null);
      return;
    }
    if (data.content) setRows((r) => [data.content, ...r]);
    if (data.variants) setRows((r) => [...data.variants, ...r]);
    if (data.bullets) setBullets(data.bullets);
    if (data.report) setBullets([...data.report.bullets, ...data.report.suggestions]);
    if (data.days) setFlash(`28 günlük plan oluşturuldu (${data.days.length} gün).`);
    if (data.suggestion) setFlash("Kampanya önerisi üretildi ve taslak olarak kaydedildi.");
    if (action === "plan") setTimeout(() => window.location.reload(), 800);
    setBusy(null);
  }

  async function act(contentId: string, action: string) {
    await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, action, actorEmail, contentId }),
    });
    if (action === "sil") setRows((r) => r.filter((x) => x.id !== contentId));
    else
      setRows((r) =>
        r.map((x) =>
          x.id === contentId
            ? {
                ...x,
                status: action === "onayla" ? "APPROVED" : action === "yayinla" ? "PUBLISHED" : "REJECTED",
              }
            : x
        )
      );
  }

  return (
    <div>
      {/* Hedef girişi */}
      <div className="border-2 border-murekkep">
        <div className="border-b-2 border-murekkep bg-murekkep px-6 py-4">
          <h2 className="font-display text-[1.28rem] font-bold text-kagit">Bugün işletmeniz için ne yapalım?</h2>
          <p className="mt-1.5 text-[0.82rem] text-kagit/70">
            Hedefini yaz, AI işletmenin sektörüne ve gerçek verilerine göre çalışsın.
          </p>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-3">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Örn. Bu hafta müşteri sayısını artırmak istiyorum."
              className="min-w-[260px] flex-1 border-2 border-murekkep/15 bg-kagit px-4 py-3.5 text-[0.95rem] focus:border-damping focus:outline-none"
            />
            <button
              onClick={() => void run("kampanya")}
              disabled={!!busy}
              className="inline-flex items-center gap-2 border-2 border-damping bg-damping px-6 py-3.5 text-[0.8rem] font-semibold uppercase tracking-[0.13em] text-kagit hover:bg-damping-dark disabled:opacity-45"
            >
              {busy === "kampanya" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI&apos;ya sor
            </button>
          </div>

          {flash ? (
            <p className="mt-3 border-l-4 border-damping bg-damping-soft/40 px-4 py-2.5 text-[0.85rem]">{flash}</p>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                onClick={() => void run(a.key)}
                disabled={!!busy}
                className="group border-2 border-murekkep/12 bg-white/55 p-4 text-left transition-all hover:border-damping hover:bg-damping-soft/30 disabled:opacity-45"
              >
                <span className="flex items-center gap-2">
                  <a.icon className="h-4 w-4 text-damping" />
                  <span className="text-[0.82rem] font-semibold">{a.label}</span>
                  {busy === a.key ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-damping" /> : null}
                </span>
                <span className="mt-1.5 block text-[0.72rem] leading-relaxed text-murekkep-soft">{a.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Analiz çıktısı */}
      {bullets.length ? (
        <div className="mt-8 border-2 border-murekkep/12 bg-white/55 p-6">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-damping">AI analizi</p>
          <ul className="mt-4 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2.5 text-[0.88rem] leading-relaxed text-murekkep-soft">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-damping" />
                {b}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[0.72rem] text-sicak-gri">
            Bu analiz yalnızca sistemdeki gerçek kayıtlardan üretilmiştir; gelecek için garanti vermez.
          </p>
        </div>
      ) : null}

      {/* İçerik onay akışı */}
      <div className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b-2 border-murekkep pb-4">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-damping">
              İçerik onay sistemi
            </p>
            <h2 className="mt-2 font-display text-[1.65rem] font-extrabold leading-none tracking-[-0.025em]">
              AI üretti, sen onayla.
            </h2>
          </div>
          <p className="max-w-[42ch] text-[0.82rem] leading-relaxed text-murekkep-soft">
            Onaylanmamış içerik yayınlanmaz; onaysız hiçbir ücretli reklam veya müşteri indirimi başlatılamaz.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="border-2 border-dashed border-murekkep/25 p-12 text-center">
            <p className="font-display text-[1.35rem] font-bold">Henüz üretilmiş içerik yok.</p>
            <p className="mt-2 text-[0.88rem] text-murekkep-soft">
              Yukarıdaki seçeneklerden biriyle başlayın; taslaklar burada listelenir.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <article key={r.id} className="border-2 border-murekkep/12 bg-white/55">
                <div className="flex flex-wrap items-center gap-2.5 border-b-2 border-murekkep/12 px-5 py-3">
                  <span className="border border-murekkep/20 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-murekkep-soft">
                    {r.kind}
                  </span>
                  {r.variant ? (
                    <span className="border border-damping/40 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-damping">
                      Varyant {r.variant}
                    </span>
                  ) : null}
                  <span className="text-[0.72rem] text-sicak-gri">{r.platform}</span>
                  <span
                    className={`ml-auto border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${
                      r.status === "PUBLISHED"
                        ? "border-[#1f6f4a] text-[#1f6f4a]"
                        : r.status === "APPROVED"
                          ? "border-murekkep text-murekkep"
                          : r.status === "REJECTED"
                            ? "border-damping text-damping"
                            : "border-amber text-[#a1720b]"
                    }`}
                  >
                    {STATUS_TR[r.status] ?? r.status}
                  </span>
                </div>

                <div className="p-5">
                  <h3 className="font-display text-[1.14rem] font-bold leading-snug">{r.title}</h3>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-[0.88rem] leading-relaxed text-murekkep-soft">
                    {r.body}
                  </pre>
                  {r.cta ? (
                    <p className="mt-3 text-[0.82rem] font-semibold text-damping">CTA: {r.cta}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <ActionBtn onClick={() => void act(r.id, "onayla")} disabled={!canApprove || r.status !== "DRAFT"}>
                      <Check className="h-3.5 w-3.5" /> Onayla
                    </ActionBtn>
                    <ActionBtn onClick={() => void act(r.id, "yayinla")} disabled={!canApprove || r.status === "PUBLISHED"}>
                      <Share2 className="h-3.5 w-3.5" /> Onayla ve yayınla
                    </ActionBtn>
                    <ActionBtn onClick={() => void act(r.id, "reddet")} disabled={!canApprove}>
                      <X className="h-3.5 w-3.5" /> Reddet
                    </ActionBtn>
                    <ActionBtn onClick={() => navigator.clipboard?.writeText(r.body).catch(() => {})}>
                      <Pencil className="h-3.5 w-3.5" /> Metni kopyala
                    </ActionBtn>
                    <ActionBtn onClick={() => void act(r.id, "sil")} danger>
                      <Trash2 className="h-3.5 w-3.5" /> Sil
                    </ActionBtn>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 border-2 px-3.5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.11em] transition-colors disabled:opacity-35 ${
        danger
          ? "border-damping/40 text-damping hover:bg-damping hover:text-kagit"
          : "border-murekkep/20 text-murekkep-soft hover:border-murekkep hover:text-murekkep"
      }`}
    >
      {children}
    </button>
  );
}

/* --------------------------- 28 GÜNLÜK PLAN ÜRETİCİ --------------------------- */
export function PlanGenerator({ slug, actorEmail }: { slug: string; actorEmail: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function generate() {
    setBusy(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        action: "plan",
        actorEmail,
        goal: "Bu hafta müşteri sayısını artırmak istiyorum.",
      }),
    });
    const data = await res.json();
    setMsg(data.ok ? "28 günlük plan oluşturuldu." : (data.error ?? "Plan oluşturulamadı."));
    setBusy(false);
    if (data.ok) setTimeout(() => window.location.reload(), 900);
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      className="inline-flex items-center gap-2 border-2 border-damping bg-damping px-5 py-3 text-[0.76rem] font-semibold uppercase tracking-[0.13em] text-kagit hover:bg-damping-dark disabled:opacity-45"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {msg || "AI ile 28 günlük plan oluştur"}
    </button>
  );
}

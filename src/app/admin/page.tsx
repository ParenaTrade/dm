import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adCampaigns,
  aiContents,
  aiSettings,
  auditLogs,
  businesses,
  dampingPool,
  fraudReviews,
  packages,
  referrals,
  transactions,
  users,
} from "@/db/schema";
import { Logo, Pill, SectionTitle, StatCard, Stamp } from "@/components/ui";
import AdminControls from "@/components/AdminControls";
import { getPoolLedgerByBusiness, getWallets } from "@/lib/queries";
import { ensureSeed } from "@/lib/seed";
import { fmtDate, fmtDateTime, fmtPercent, fmtTL } from "@/lib/format";
import { ShieldAlert, Database, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await ensureSeed();

  const [
    bizRows,
    pkgRows,
    txRows,
    poolRows,
    walletRows,
    refRows,
    fraudRows,
    adRows,
    auditRows,
    aiRows,
    contentRows,
    userRows,
    pool,
  ] = await Promise.all([
    db.select().from(businesses).orderBy(desc(businesses.rating)),
    db.select().from(packages),
    db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(25),
    getPoolLedgerByBusiness(),
    getWallets(),
    db.select().from(referrals),
    db.select().from(fraudReviews).orderBy(desc(fraudReviews.createdAt)),
    db.select().from(adCampaigns),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(12),
    db.select().from(aiSettings),
    db.select().from(aiContents).orderBy(desc(aiContents.createdAt)).limit(8),
    db.select().from(users),
    db.select().from(dampingPool),
  ]);

  const completed = txRows.filter((t) => t.status === "COMPLETED");
  const gross = completed.reduce((s, t) => s + t.grossAmountCents, 0);
  const commission = completed.reduce((s, t) => s + t.commissionCents, 0);
  const dampingUsed = completed.reduce((s, t) => s + t.dampingUsedCents, 0);
  const poolBalance = pool[0]?.balanceCents ?? 0;

  return (
    <div className="min-h-screen">
      {/* ADMIN BANDI */}
      <div className="border-b-2 border-murekkep bg-murekkep">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-2.5">
          <p className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-kagit/80">
            DampingVar Yönetim Paneli · Yetkili erişim
          </p>
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-kagit/60">
            Tüm finansal hareketler audit log ile izlenir
          </p>
        </div>
      </div>

      <header className="border-b-2 border-murekkep bg-kagit">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-5 px-5 py-4">
          <div className="flex items-center gap-5">
            <Logo />
            <span className="border-l-2 border-murekkep/15 pl-5">
              <Stamp>Admin</Stamp>
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.74rem] font-semibold uppercase tracking-[0.12em]">
            <a href="#isletmeler" className="hover:text-damping">İşletmeler</a>
            <a href="#paketler" className="hover:text-damping">Paketler</a>
            <a href="#islemler" className="hover:text-damping">QR / Satış</a>
            <a href="#hane" className="hover:text-damping">Damping Hane</a>
            <a href="#mahsup" className="hover:text-damping">Mahsuplaşma</a>
            <a href="#fraud" className="hover:text-damping">Fraud</a>
            <a href="#ai" className="hover:text-damping">AI</a>
            <a href="#log" className="hover:text-damping">Audit</a>
            <Link href="/" className="inline-flex items-center gap-1.5 text-murekkep-soft hover:text-damping">
              <ArrowLeft className="h-3.5 w-3.5" /> Site
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-5 py-10">
        <SectionTitle
          eyebrow="Genel durum"
          title="DampingVar platform göstergeleri."
          note="Rakamlar doğrudan veritabanındaki gerçek kayıtlardan okunur."
          action={<Pill tone="damping"><Database className="h-3 w-3" /> Canlı veri</Pill>}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Kayıtlı işletme" value={String(bizRows.length)} sub="Damping Noktası" accent />
          <StatCard label="İşlem (son 25)" value={String(completed.length)} sub="Doğrulanmış satış" />
          <StatCard label="Brüt satış" value={fmtTL(gross)} sub="Toplam ciro" />
          <StatCard label="DampingVar komisyonu" value={fmtTL(commission)} sub="Platform geliri" />
          <StatCard label="Ortak havuz" value={fmtTL(poolBalance)} sub="Damping Hane finansmanı" />
          <StatCard label="Damping Hane kullanımı" value={fmtTL(dampingUsed)} sub="Kasada harcanan hak" />
          <StatCard label="Cüzdan" value={String(walletRows.length)} sub="Kayıtlı müşteri cüzdanı" />
          <StatCard label="Referral" value={String(refRows.length)} sub="Tek seviye davet kaydı" />
        </div>

        {/* İŞLETMELER */}
        <section id="isletmeler" className="mt-12">
          <SectionTitle eyebrow="İşletmeler" title="Damping Noktaları." />
          <div className="overflow-x-auto thin-scroll border-2 border-murekkep/12">
            <table className="w-full min-w-[820px] text-[0.82rem]">
              <thead>
                <tr className="bg-murekkep text-kagit">
                  {["İşletme", "Kategori", "İlçe", "Paket", "Puan", "Yorum", "Durum", "Vitrin"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[0.62rem] font-semibold uppercase tracking-[0.13em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bizRows.map((b) => (
                  <tr key={b.id} className="border-b border-murekkep/10 last:border-0 odd:bg-kagit/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{b.name}</p>
                      <p className="tabular text-[0.72rem] text-sicak-gri">{b.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-murekkep-soft">{b.subCategory ?? b.category}</td>
                    <td className="px-4 py-3 text-murekkep-soft">{b.district}</td>
                    <td className="px-4 py-3">
                      <Pill tone={b.planCode === "BOOST" ? "damping" : b.planCode === "PRO" ? "ink" : "neutral"}>
                        {b.planCode}
                      </Pill>
                    </td>
                    <td className="tabular px-4 py-3">{b.rating.toFixed(1)}</td>
                    <td className="tabular px-4 py-3">{b.reviewCount}</td>
                    <td className="px-4 py-3">
                      <Pill tone={b.verified ? "green" : "neutral"}>{b.verified ? "Doğrulandı" : "Bekliyor"}</Pill>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/isletme/${b.slug}`} className="text-damping hover:underline">
                        /isletme/{b.slug}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* PAKETLER + FRAUD */}
        <section id="paketler" className="mt-12">
          <SectionTitle
            eyebrow="Paketler & Güvenlik"
            title="Abonelik yönetimi ve fraud kontrolü."
            note="Paket fiyatları admin tarafından yönetilir. Fraud sinyalleri otomatik işaretlenir, karar admindedir."
          />
          <div id="fraud">
            <AdminControls
              packages={pkgRows.map((p) => ({
                code: p.code,
                name: p.name,
                priceMonthlyCents: p.priceMonthlyCents,
              }))}
              frauds={fraudRows.map((f) => ({
                id: f.id,
                reason: f.reason,
                status: f.status,
                signals: (f.signals ?? []) as string[],
              }))}
            />
          </div>
        </section>

        {/* İŞLEMLER */}
        <section id="islemler" className="mt-12">
          <SectionTitle
            eyebrow="QR İşlemleri & Satışlar"
            title="Son finansal hareketler."
            note="Tamamlanmış işlemler silinemez; yalnızca iade (reversal) kaydı oluşturulur."
          />
          <div className="overflow-x-auto thin-scroll border-2 border-murekkep/12">
            <table className="w-full min-w-[900px] text-[0.8rem]">
              <thead>
                <tr className="bg-murekkep text-kagit">
                  {["Fiş", "Tarih", "Brüt", "İndirim", "Damping Hane", "Net", "Komisyon", "Havuz", "Durum"].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[0.6rem] font-semibold uppercase tracking-[0.12em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txRows.map((t) => (
                  <tr key={t.id} className="border-b border-murekkep/10 last:border-0 odd:bg-kagit/40">
                    <td className="tabular px-3.5 py-2.5 font-semibold">{t.receiptNo}</td>
                    <td className="px-3.5 py-2.5 text-sicak-gri">{fmtDateTime(t.createdAt)}</td>
                    <td className="tabular px-3.5 py-2.5">{fmtTL(t.grossAmountCents)}</td>
                    <td className="tabular px-3.5 py-2.5 text-damping">-{fmtTL(t.discountCents)}</td>
                    <td className="tabular px-3.5 py-2.5">-{fmtTL(t.dampingUsedCents)}</td>
                    <td className="tabular px-3.5 py-2.5 font-semibold">{fmtTL(t.netAmountCents)}</td>
                    <td className="tabular px-3.5 py-2.5">{fmtTL(t.commissionCents)}</td>
                    <td className="tabular px-3.5 py-2.5">{fmtTL(t.poolContributionCents)}</td>
                    <td className="px-3.5 py-2.5">
                      <Pill tone={t.status === "COMPLETED" ? "green" : t.status === "REVERSED" ? "neutral" : "amber"}>
                        {t.status}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* MAHSUPLAŞMA */}
        <section id="hane" className="mt-12">
          <SectionTitle
            eyebrow="Damping Hane & Mahsuplaşma"
            title="İşletmeler arası mahsup raporu."
            note="Network-wide çalışan Damping Hane nedeniyle her işletmenin havuza katkısı ve havuzdan kullanımı ayrı ayrı izlenir."
            action={
              <Pill tone="ink">
                <ShieldAlert className="h-3 w-3" /> V1: otomatik transfer yok
              </Pill>
            }
          />
          <div id="mahsup" className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="border-2 border-murekkep/12">
              <table className="w-full text-[0.84rem]">
                <thead>
                  <tr className="bg-murekkep text-kagit">
                    {["İşletme", "Havuza katkı", "Havuzdan kullanım", "Net pozisyon"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[0.62rem] font-semibold uppercase tracking-[0.13em]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {poolRows.map((r) => (
                    <tr key={r.businessId} className="border-b border-murekkep/10 last:border-0 odd:bg-kagit/40">
                      <td className="px-4 py-3 font-semibold">{r.name}</td>
                      <td className="tabular px-4 py-3">{fmtTL(r.contributedCents)}</td>
                      <td className="tabular px-4 py-3">{fmtTL(r.consumedCents)}</td>
                      <td
                        className={`tabular px-4 py-3 font-semibold ${
                          r.netCents >= 0 ? "text-[#1f6f4a]" : "text-damping"
                        }`}
                      >
                        {r.netCents >= 0 ? "+" : "-"}
                        {fmtTL(Math.abs(r.netCents))}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-murekkep bg-kagit-2">
                    <td className="px-4 py-3 font-semibold">Ortak havuz bakiyesi</td>
                    <td className="tabular px-4 py-3" colSpan={2}>
                      {fmtTL(poolRows.reduce((s, r) => s + r.contributedCents, 0))} katkı
                    </td>
                    <td className="tabular px-4 py-3 font-semibold text-damping">{fmtTL(poolBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border-2 border-dashed border-damping/45 p-5">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-damping-dark">
                Havuz kuralları
              </p>
              <ul className="mt-3.5 space-y-2.5 text-[0.84rem] leading-relaxed text-murekkep-soft">
                <li>• Ödül karşılıksız oluşturulamaz.</li>
                <li>• Gerçekleşmiş ve uygun işlem olmadan Damping Hane üretilemez.</li>
                <li>• Havuz negatife getirilemez.</li>
                <li>• İade durumunda havuz katkısı ters kayıtla düzeltilir.</li>
                <li>• Audit trail korunur.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* REFERRAL */}
        <section className="mt-12">
          <SectionTitle eyebrow="Paylaş & Kazan" title="Referral kayıtları." note="Tek seviye. B → C için A'ya ikinci seviye ödül üretilmez." />
          <div className="overflow-x-auto thin-scroll border-2 border-murekkep/12">
            <table className="w-full min-w-[640px] text-[0.82rem]">
              <thead>
                <tr className="bg-murekkep text-kagit">
                  {["Kod", "Davet eden", "Davet edilen", "Durum", "Tarih"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[0.62rem] font-semibold uppercase tracking-[0.13em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {refRows.map((r) => {
                  const inviter = userRows.find((u) => u.id === r.inviterId);
                  const invitee = userRows.find((u) => u.id === r.inviteeId);
                  return (
                    <tr key={r.id} className="border-b border-murekkep/10 last:border-0 odd:bg-kagit/40">
                      <td className="tabular px-4 py-2.5 font-semibold text-damping">{r.code}</td>
                      <td className="px-4 py-2.5">{inviter?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">{invitee?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Pill tone={r.status === "QUALIFIED" ? "green" : "neutral"}>{r.status}</Pill>
                      </td>
                      <td className="px-4 py-2.5 text-sicak-gri">{fmtDate(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* REKLAM + AI */}
        <section id="ai" className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow="Reklam" title="Reklam kampanyaları." />
            <ul className="border-2 border-murekkep/12">
              {adRows.map((ad) => {
                const biz = bizRows.find((b) => b.id === ad.businessId);
                return (
                  <li key={ad.id} className="border-b border-murekkep/10 px-5 py-4 last:border-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{ad.name}</p>
                        <p className="text-[0.76rem] text-sicak-gri">
                          {biz?.name} · {ad.placement} · {ad.district}
                        </p>
                      </div>
                      <Pill tone={ad.status === "ACTIVE" ? "green" : "neutral"}>{ad.status}</Pill>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-5 text-[0.76rem] text-murekkep-soft">
                      <span className="tabular">Gösterim {ad.impressions.toLocaleString("tr-TR")}</span>
                      <span className="tabular">Tıklama {ad.clicks.toLocaleString("tr-TR")}</span>
                      <span className="tabular">
                        CTR {fmtPercent(ad.impressions ? ad.clicks / ad.impressions : 0, 2)}
                      </span>
                      <span className="tabular">Bütçe {fmtTL(ad.budgetCents)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 border-2 border-murekkep/12">
              <div className="border-b-2 border-murekkep/12 px-5 py-3.5">
                <h2 className="font-display text-[1.06rem] font-bold">AI servis ayarları</h2>
              </div>
              <ul>
                {aiRows.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-murekkep/10 px-5 py-3 last:border-0">
                    <div>
                      <p className="text-[0.82rem] font-semibold">{row.key}</p>
                      <p className="text-[0.72rem] text-sicak-gri">{row.description}</p>
                    </div>
                    <p className="tabular text-[0.82rem]">
                      {row.key.includes("api_key") ? "••••••••" : row.value}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <SectionTitle eyebrow="AI İçerikleri" title="Üretilen içerikler." />
            <ul className="space-y-3">
              {contentRows.map((c) => {
                const biz = bizRows.find((b) => b.id === c.businessId);
                return (
                  <li key={c.id} className="border-2 border-murekkep/12 bg-white/55 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border border-murekkep/20 px-2 py-1 text-[0.62rem] uppercase tracking-[0.12em] text-murekkep-soft">
                        {c.kind}
                      </span>
                      <span className="text-[0.72rem] text-sicak-gri">{biz?.name}</span>
                      <Pill
                        tone={
                          c.status === "PUBLISHED" ? "green" : c.status === "DRAFT" ? "amber" : "neutral"
                        }
                      >
                        {c.status}
                      </Pill>
                    </div>
                    <p className="mt-2.5 font-semibold">{c.title}</p>
                    <p className="mt-1.5 line-clamp-2 text-[0.82rem] leading-relaxed text-murekkep-soft">
                      {c.body}
                    </p>
                  </li>
                );
              })}
            </ul>

            {/* Audit */}
            <div id="log" className="mt-8">
              <SectionTitle eyebrow="Audit Logs" title="İşlem kayıtları." />
              <ul className="border-2 border-murekkep/12">
                {auditRows.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-murekkep/10 px-4 py-2.5 text-[0.78rem] last:border-0">
                    <div>
                      <p className="font-semibold">{l.action}</p>
                      <p className="text-[0.72rem] text-sicak-gri">
                        {l.actor} · {l.role} · {l.entityType}
                      </p>
                    </div>
                    <span className="tabular text-[0.72rem] text-sicak-gri">{fmtDateTime(l.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* V1 KAPSAMI */}
        <section className="mt-12 border-2 border-murekkep bg-kagit-2 p-8">
          <h2 className="font-display text-[1.65rem] font-extrabold leading-tight tracking-[-0.025em]">
            V1 kapsamında olmayanlar
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              ["Ödeme tahsilatı", "DampingVar müşteri parasını tahsil etmez; ödeme doğrudan işletmeye yapılır."],
              ["Stok, ürün, kargo", "DampingVar stok tutmaz, ürün satmaz, kendi kargosunu yapmaz."],
              ["Nakit Damping Hane", "Damping Hane çekilemez, banka hesabına aktarılamaz, devredilemez."],
              ["MLM yapısı", "Çok seviyeli ödül sistemi kurulmaz; yalnızca tek seviye referral vardır."],
              ["Silinen işlem", "Tamamlanmış işlemler silinmez, yalnızca reversal kaydı oluşturulur."],
              ["Otomatik reklam", "AI onaysız ücretli reklam başlatmaz veya indirim tanımlamaz."],
            ].map(([t, d]) => (
              <div key={t} className="border-l-4 border-damping pl-4">
                <h3 className="font-display text-[1.02rem] font-bold">{t}</h3>
                <p className="mt-1.5 text-[0.84rem] leading-relaxed text-murekkep-soft">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-murekkep bg-kagit-2">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-5 py-8">
          <Logo />
          <p className="text-[0.78rem] text-murekkep-soft">
            DampingVar Yönetim Paneli · {fmtDate(new Date())} · {bizRows.length} işletme ·{" "}
            {txRows.length} son işlem
          </p>
        </div>
      </footer>
    </div>
  );
}

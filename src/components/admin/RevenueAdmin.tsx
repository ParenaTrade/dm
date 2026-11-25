"use client";

import { useEffect, useState } from "react";

type Row = {
  id: number;
  name: string;
  clicksTotal: number;
  clicksWeek: number;
  clicksToday: number;
  signups: number;
  deposits: number;
  amount: number;
  commission: number;
};
type Data = {
  totals: { clicks: number; signups: number; deposits: number; commission: number };
  sponsors: Row[];
  postbackReady: boolean;
};

const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export function RevenueAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
    void fetch("/api/revenue", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.ok && setData(d as Data))
      .catch(() => undefined);
  }, []);

  const cards = data
    ? [
        ["Toplam tıklama", fmt(data.totals.clicks)],
        ["Kayıt", fmt(data.totals.signups)],
        ["Yatırım yapan", fmt(data.totals.deposits)],
        ["Komisyon", fmt(data.totals.commission)],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-2xl text-gold">Gelir ve Dönüşümler</h3>
        <p className="text-sm text-white/50">Tıklamalar otomatik sayılır. Kayıt/yatırım/komisyon, affiliate ağının postback bildirimiyle gelir.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="glass-dark rounded-2xl p-4">
            <p className="font-display text-3xl text-gold">{value}</p>
            <p className="text-[11px] uppercase tracking-wider text-white/50">{label}</p>
          </div>
        ))}
      </div>

      <div className="glass-dark overflow-x-auto rounded-2xl p-3">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-white/45">
            <tr>
              <th className="p-2">Sponsor</th>
              <th className="p-2">Bugün</th>
              <th className="p-2">7 gün</th>
              <th className="p-2">Toplam tık</th>
              <th className="p-2">Kayıt</th>
              <th className="p-2">Yatırım</th>
              <th className="p-2">Tutar</th>
              <th className="p-2">Komisyon</th>
            </tr>
          </thead>
          <tbody>
            {data?.sponsors.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-2 font-semibold">{r.name}</td>
                <td className="p-2">{fmt(r.clicksToday)}</td>
                <td className="p-2">{fmt(r.clicksWeek)}</td>
                <td className="p-2">{fmt(r.clicksTotal)}</td>
                <td className="p-2">{fmt(r.signups)}</td>
                <td className="p-2">{fmt(r.deposits)}</td>
                <td className="p-2">{fmt(r.amount)}</td>
                <td className="p-2 text-gold">{fmt(r.commission)}</td>
              </tr>
            ))}
            {data && data.sponsors.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-white/40">Henüz sponsor yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="glass-dark space-y-2 rounded-2xl p-4 text-sm text-white/70">
        <p className="font-semibold text-white">Postback (komisyonu otomatik yazdır)</p>
        <p>
          Affiliate ağının panelinde postback / S2S adresi olarak şunu gir (ağın makro adlarına göre {"{click_id}"}, {"{amount}"},
          {" {commission}"} yerlerini düzenle):
        </p>
        <code className="block overflow-x-auto rounded-xl bg-black/50 p-3 text-xs text-goldsoft">
          {origin}/api/postback?secret=GIZLI_ANAHTAR&amp;click_id={"{click_id}"}&amp;event=ftd&amp;amount={"{amount}"}&amp;commission={"{commission}"}
        </code>
        <p className="text-xs text-white/45">
          event: signup (kayıt), ftd veya deposit (yatırım). Gizli anahtar Vercel&apos;de <b>AFFILIATE_POSTBACK_SECRET</b> olarak tanımlanır
          {data && (data.postbackReady ? " — tanımlı ✓" : " — şu an TANIMLI DEĞİL, postback çalışmaz.")}.
        </p>
      </div>
    </div>
  );
}

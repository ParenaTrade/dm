import Link from "next/link";
import { db } from "@/db";
import {
  auditLogs, channels, chatMessages, coinLedger, deletionRequests, featureFlags, predictions, profiles, quests,
  siteSettings, sponsorClicks, sponsorGeoRules, sponsors, storeItems,
} from "@/db/schema";
import { count, desc, eq, gte, ilike, isNull, sql } from "drizzle-orm";
import { Flash, Page, PageHeader } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { envReport, livekitConfig } from "@/lib/env";
import { roomParticipantCount } from "@/lib/livekit";
import { is2faVerified, otpauthUrl } from "@/lib/totp";
import * as A from "./actions";

export const dynamic = "force-dynamic";
const TABS = [["overview", "Genel"], ["users", "Kullanıcılar"], ["channels", "Kanallar"], ["sponsors", "Sponsorlar"], ["content", "İçerik"], ["moderation", "Moderasyon"], ["flags", "Flag & Ayarlar"], ["audit", "Audit"], ["security", "2FA"]];

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; msg?: string; q?: string }> }) {
  const sp = await searchParams;
  const u = await getUser();
  if (u?.role !== "admin") return <Page><div className="card p-8 text-center text-muted">Bu sayfa yalnızca adminlere açıktır.</div></Page>;
  const verified = await is2faVerified();
  const needs2fa = (u.totpEnabled && !verified) || (process.env.ADMIN_REQUIRE_2FA === "true" && !u.totpEnabled);
  const tab = needs2fa ? "security" : sp.tab ?? "overview";

  return (
    <Page>
      <PageHeader icon="⚙️" title="Yönetim Paneli" />
      <Flash msg={sp.msg} />
      {!u.totpEnabled && <div className="card p-3 mb-4 text-sm border-yellow-500/50 text-yellow-300">⚠️ Admin hesabın için 2FA kapalı. <Link href="/admin?tab=security" className="underline">Şimdi kur</Link> (üretimde ADMIN_REQUIRE_2FA=true ile zorunlu).</div>}
      <div className="flex flex-wrap gap-1 mb-5">{TABS.map(([k, l]) => <Link key={k} href={`/admin?tab=${k}`} className={`btn py-1.5 ${tab === k ? "btn-red" : "btn-ghost"}`}>{l}</Link>)}</div>
      {tab === "overview" && <Overview />}
      {tab === "users" && <Users q={sp.q} />}
      {tab === "channels" && <Channels />}
      {tab === "sponsors" && <Sponsors />}
      {tab === "content" && <Content />}
      {tab === "moderation" && <Moderation />}
      {tab === "flags" && <Flags />}
      {tab === "audit" && <Audit />}
      {tab === "security" && <Security username={u.username} secret={u.totpSecret} enabled={u.totpEnabled} verified={verified} />}
    </Page>
  );
}

const Box = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="card p-4 mb-4"><h2 className="font-bold mb-3">{title}</h2>{children}</section>;

async function Overview() {
  const day = new Date(Date.now() - 864e5);
  const [[users], [clicks], [msgs], [ledger], ch] = await Promise.all([
    db.select({ n: count() }).from(profiles), db.select({ n: count() }).from(sponsorClicks).where(gte(sponsorClicks.createdAt, day)),
    db.select({ n: count() }).from(chatMessages).where(gte(chatMessages.createdAt, day)),
    db.select({ n: sql<string>`coalesce(sum(case when delta>0 then delta else 0 end),0)` }).from(coinLedger).where(gte(coinLedger.createdAt, day)),
    db.select().from(channels),
  ]);
  const lk = livekitConfig();
  const live = ch.find((c) => c.isLive);
  const lkCount = live && lk.ok ? await roomParticipantCount(live.id) : null;
  return (<>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {[["Kullanıcı", users.n], ["Sponsor tık. (24s)", clicks.n], ["Mesaj (24s)", msgs.n], ["Dağıtılan coin (24s)", Number(ledger.n)]].map(([l, v]) => <div key={l} className="card p-4"><div className="text-xs text-muted">{l}</div><div className="text-2xl font-black">{Number(v).toLocaleString("tr-TR")}</div></div>)}
    </div>
    <Box title="Sistem sağlığı">
      <div className="grid md:grid-cols-2 gap-2 text-sm">
        <div>Veritabanı: <span className="text-green-400">● bağlı</span></div>
        <div>LiveKit: {lk.ok ? <span className="text-green-400">● yapılandırıldı{lkCount != null && ` · odada ${lkCount} katılımcı`}</span> : <span className="text-yellow-400">● eksik ({lk.missing.join(", ")})</span>}</div>
        {envReport().map((e) => <div key={e.key} className="text-xs"><code>{e.key}</code>: {e.set ? <span className="text-green-400">tanımlı</span> : <span className={e.required ? "text-red-400" : "text-yellow-400"}>eksik</span>} <span className="text-muted">({e.scope})</span></div>)}
      </div>
    </Box>
  </>);
}

async function Users({ q }: { q?: string }) {
  const list = await db.select().from(profiles).where(q ? ilike(profiles.username, `%${q}%`) : undefined).orderBy(desc(profiles.createdAt)).limit(50);
  return (
    <Box title="Kullanıcılar">
      <form className="flex gap-2 mb-3"><input type="hidden" name="tab" value="users" /><input name="q" defaultValue={q} className="input" placeholder="Kullanıcı ara" /><button className="btn btn-ghost">Ara</button></form>
      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm bg-white/5 rounded-lg p-2">
            <b className="w-32 truncate">{p.username}</b><span className="text-muted">Lv{p.level} · 🪙{p.coinBalance}</span>
            {p.bannedUntil && p.bannedUntil > new Date() && <span className="badge bg-red-600/30 text-red-300">banlı</span>}
            <div className="flex-1" />
            <form action={A.userRole} className="flex gap-1"><input type="hidden" name="id" value={p.id} /><select name="role" defaultValue={p.role} className="input !w-24 !py-1">{["user", "mod", "host", "admin"].map((r) => <option key={r}>{r}</option>)}</select><button className="btn btn-ghost py-1 px-2 text-xs">Rol</button></form>
            <form action={A.coinAdjust} className="flex gap-1"><input type="hidden" name="id" value={p.id} /><input name="delta" type="number" placeholder="±coin" className="input !w-24 !py-1" /><button className="btn btn-ghost py-1 px-2 text-xs">Düzelt</button></form>
            <form action={A.userBan} className="flex gap-1"><input type="hidden" name="id" value={p.id} /><select name="hours" className="input !w-24 !py-1"><option value="0">Yasak yok</option><option value="24">24 saat</option><option value="168">7 gün</option><option value="876000">Kalıcı</option></select><button className="btn btn-ghost py-1 px-2 text-xs">Uygula</button></form>
          </div>
        ))}
      </div>
    </Box>
  );
}

async function Channels() {
  const list = await db.select({ c: channels, owner: profiles.username }).from(channels).innerJoin(profiles, eq(profiles.id, channels.ownerId));
  return (<>
    <Box title="Kanallar">
      {list.map(({ c, owner }) => (
        <div key={c.id} className="flex items-center gap-3 text-sm bg-white/5 rounded-lg p-2 mb-2">
          <b>/{c.slug}</b><span className="text-muted">{owner}</span>{c.isLive && <span className="badge bg-red-600">CANLI</span>}<span className={c.status === "suspended" ? "text-red-400" : "text-green-400"}>{c.status}</span>
          <div className="flex-1" />
          <form action={A.channelStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value={c.status === "active" ? "suspended" : "active"} /><button className="btn btn-ghost py-1 text-xs">{c.status === "active" ? "Askıya al" : "Aktifleştir"}</button></form>
        </div>
      ))}
    </Box>
    <Box title="Yeni kanal / yayıncı">
      <form action={A.channelCreate} className="flex flex-wrap gap-2"><input name="username" placeholder="kullanıcı adı" className="input !w-48" /><input name="slug" placeholder="kanal-slug" className="input !w-48" /><button className="btn btn-red">Oluştur</button></form>
    </Box>
  </>);
}

async function Sponsors() {
  const [list, rules, report] = await Promise.all([
    db.select().from(sponsors).orderBy(sponsors.sortOrder), db.select().from(sponsorGeoRules),
    db.select({ sponsorId: sponsorClicks.sponsorId, country: sponsorClicks.country, n: count() }).from(sponsorClicks).where(gte(sponsorClicks.createdAt, new Date(Date.now() - 30 * 864e5))).groupBy(sponsorClicks.sponsorId, sponsorClicks.country),
  ]);
  const name = (id: number | null) => list.find((x) => x.id === id)?.name ?? "?";
  return (<>
    <Box title="Sponsorlar">
      {list.map((x) => (
        <details key={x.id} className="bg-white/5 rounded-lg p-2 mb-2">
          <summary className="cursor-pointer text-sm flex items-center gap-2"><b style={{ color: x.color }}>{x.name}</b><span className="badge bg-white/10">{x.category}</span>{!x.isActive && <span className="text-red-400 text-xs">pasif</span>}<span className="text-muted text-xs ml-auto">{report.filter((r) => r.sponsorId === x.id).reduce((a, r) => a + r.n, 0)} tık (30g)</span></summary>
          <SponsorForm s={x} />
          <form action={A.sponsorToggle} className="mt-2"><input type="hidden" name="id" value={x.id} /><input type="hidden" name="active" value={x.isActive ? "0" : "1"} /><button className="btn btn-ghost py-1 text-xs">{x.isActive ? "Pasifleştir" : "Aktifleştir"}</button></form>
        </details>
      ))}
      <details className="mt-3"><summary className="btn btn-red cursor-pointer">+ Yeni sponsor</summary><SponsorForm /></details>
    </Box>
    <Box title="Geo kuralları (x-vercel-ip-country)">
      <div className="space-y-1 mb-3">{rules.map((r) => <form key={r.id} action={A.geoDelete} className="flex items-center gap-2 text-sm"><input type="hidden" name="id" value={r.id} /><code>{r.countryCode}</code> → {r.sponsorId ? name(r.sponsorId) : `kategori: ${r.category}`} = {r.visible ? <span className="text-green-400">görünür</span> : <span className="text-red-400">gizli</span>}<button className="text-xs text-muted underline">sil</button></form>)}</div>
      <form action={A.geoAdd} className="flex flex-wrap gap-2">
        <input name="cc" placeholder="TR" className="input !w-20" maxLength={2} />
        <select name="target" className="input !w-56">{["casino", "gaming", "tech", "other"].map((c) => <option key={c} value={`c:${c}`}>Kategori: {c}</option>)}{list.map((x) => <option key={x.id} value={`s:${x.id}`}>Sponsor: {x.name}</option>)}</select>
        <select name="visible" className="input !w-32"><option value="0">Gizle</option><option value="1">Göster</option></select>
        <button className="btn btn-red">Kural ekle</button>
      </form>
    </Box>
    <Box title="Sponsor oyunu ekle">
      <form action={A.gameAdd} className="flex flex-wrap gap-2"><select name="sponsorId" className="input !w-48">{list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><input name="title" placeholder="Oyun adı" className="input !w-48" /><input name="launchUrl" placeholder="https://…" className="input !w-64" /><button className="btn btn-red">Ekle</button></form>
    </Box>
    <Box title="Tıklama raporu (30 gün, ülke bazlı)">
      <table className="w-full text-sm"><thead className="text-muted text-xs"><tr><th className="text-left">Sponsor</th><th className="text-left">Ülke</th><th className="text-right">Tık</th></tr></thead>
        <tbody>{report.sort((a, b) => b.n - a.n).map((r, i) => <tr key={i} className="border-t border-line"><td className="py-1">{name(r.sponsorId)}</td><td>{r.country}</td><td className="text-right">{r.n}</td></tr>)}</tbody></table>
    </Box>
  </>);
}

function SponsorForm({ s }: { s?: typeof sponsors.$inferSelect }) {
  return (
    <form action={A.sponsorSave} className="grid md:grid-cols-3 gap-2 mt-3">
      <input type="hidden" name="id" value={s?.id ?? 0} />
      <input name="name" defaultValue={s?.name} placeholder="Ad" className="input" required />
      <input name="slug" defaultValue={s?.slug} placeholder="slug" className="input" required />
      <select name="category" defaultValue={s?.category ?? "other"} className="input">{["casino", "gaming", "tech", "other"].map((c) => <option key={c}>{c}</option>)}</select>
      <input name="affiliateUrl" defaultValue={s?.affiliateUrl} placeholder="https://affiliate…" className="input md:col-span-2" required />
      <input name="promoCode" defaultValue={s?.promoCode ?? ""} placeholder="Promosyon kodu" className="input" />
      <input name="description" defaultValue={s?.description} placeholder="Açıklama (garanti kazanç dili kullanma)" className="input md:col-span-3" />
      <input name="ctaText" defaultValue={s?.ctaText ?? "Bonusu Al"} className="input" />
      <input name="color" type="color" defaultValue={s?.color ?? "#dc2626"} className="input h-10" />
      <input name="sortOrder" type="number" defaultValue={s?.sortOrder ?? 0} className="input" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" defaultChecked={s?.isFeatured} /> Öne çıkan (büyük kart + hero)</label>
      <button className="btn btn-red md:col-span-2">Kaydet</button>
    </form>
  );
}

async function Content() {
  const [qs, preds, items] = await Promise.all([db.select().from(quests), db.select().from(predictions).where(eq(predictions.status, "open")), db.select().from(storeItems)]);
  return (<>
    <Box title="Tahminler">
      <form action={A.predCreate} className="flex flex-wrap gap-2 mb-3"><input name="title" placeholder="Soru" className="input !w-72" /><select name="type" className="input !w-28"><option>yesno</option><option>hunt</option><option>range</option></select><input name="options" placeholder="Evet, Hayır" className="input !w-48" /><input name="minutes" type="number" defaultValue={30} className="input !w-20" /><button className="btn btn-red">Aç</button></form>
      {preds.map((p) => <form key={p.id} action={A.predSettle} className="flex flex-wrap gap-2 items-center text-sm mb-1"><input type="hidden" name="id" value={p.id} /><span className="flex-1">{p.title} (havuz {p.totalPool})</span><select name="result" className="input !w-36 !py-1"><option value="">İptal / iade</option>{p.options.map((o) => <option key={o}>{o}</option>)}</select><button className="btn btn-ghost py-1 text-xs">Sonuçlandır</button></form>)}
    </Box>
    <Box title="Promosyon ekle">
      <form action={A.promoCreate} className="grid md:grid-cols-3 gap-2"><input name="title" placeholder="Başlık" className="input" required /><select name="type" className="input"><option value="event">Etkinlik</option><option value="quest">Görev</option><option value="tournament">Turnuva</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isFeatured" /> Öne çıkan</label><input name="description" placeholder="Açıklama" className="input md:col-span-3" /><input name="startsAt" type="datetime-local" className="input" required /><input name="endsAt" type="datetime-local" className="input" required /><button className="btn btn-red">Ekle</button></form>
    </Box>
    <Box title="Görevler">
      {qs.map((q) => <form key={q.id} action={A.questToggle} className="flex items-center gap-2 text-sm mb-1"><input type="hidden" name="id" value={q.id} /><input type="hidden" name="active" value={q.isActive ? "0" : "1"} /><span className="badge bg-white/10">{q.kind}</span><span className="flex-1">{q.title} · 🪙{q.rewardCoin} · {q.rules.event}×{q.rules.target}</span><button className="btn btn-ghost py-1 text-xs">{q.isActive ? "Kapat" : "Aç"}</button></form>)}
      <form action={A.questCreate} className="flex flex-wrap gap-2 mt-3"><select name="kind" className="input !w-28"><option>daily</option><option>social</option></select><input name="title" placeholder="Başlık" className="input !w-56" /><select name="event" className="input !w-44">{["watch_minutes", "originals_round", "chat_message", "question", "social_telegram", "social_youtube"].map((e) => <option key={e}>{e}</option>)}</select><input name="target" type="number" defaultValue={1} className="input !w-20" /><input name="reward" type="number" defaultValue={50} className="input !w-24" /><input name="url" placeholder="Sosyal URL" className="input !w-48" /><button className="btn btn-red">Ekle</button></form>
    </Box>
    <Box title="Store çekilişleri (flag kapalıysa kullanıcıya görünmez)">
      {items.map((it) => <form key={it.id} action={A.storeDraw} className="flex items-center gap-2 text-sm mb-1"><input type="hidden" name="id" value={it.id} /><span className="flex-1">{it.title} {it.winnerId && "· kazanan seçildi"}</span>{it.isActive && <button className="btn btn-ghost py-1 text-xs">Kazananı çek</button>}</form>)}
    </Box>
  </>);
}

async function Moderation() {
  const [msgs, reqs] = await Promise.all([
    db.select({ m: chatMessages, username: profiles.username }).from(chatMessages).innerJoin(profiles, eq(profiles.id, chatMessages.userId)).where(isNull(chatMessages.deletedBy)).orderBy(desc(chatMessages.id)).limit(40),
    db.select({ r: deletionRequests, username: profiles.username }).from(deletionRequests).innerJoin(profiles, eq(profiles.id, deletionRequests.userId)).orderBy(desc(deletionRequests.id)).limit(20),
  ]);
  return (<>
    <Box title="KVKK veri silme talepleri">
      {reqs.length === 0 && <p className="text-sm text-muted">Talep yok.</p>}
      {reqs.map(({ r, username }) => <form key={r.id} action={A.deletionProcess} className="flex items-center gap-2 text-sm mb-1"><input type="hidden" name="id" value={r.id} /><span className="flex-1">{username} · {r.createdAt.toLocaleString("tr-TR")} · {r.status}</span>{r.status === "pending" && <button className="btn btn-ghost py-1 text-xs text-red-400">Anonimleştir</button>}</form>)}
    </Box>
    <Box title="Son sohbet mesajları">
      {msgs.map(({ m, username }) => <form key={m.id} action={A.msgDelete} className="flex items-center gap-2 text-sm py-0.5"><input type="hidden" name="id" value={m.id} /><span className="text-muted text-xs w-24">{m.room}</span><b className="w-28 truncate">{username}</b><span className="flex-1 truncate">{m.body}</span><button className="text-xs text-red-400">sil</button></form>)}
    </Box>
  </>);
}

async function Flags() {
  const [flags, settings] = await Promise.all([db.select().from(featureFlags), db.select().from(siteSettings)]);
  return (<>
    <Box title="Feature flag'ler">
      {flags.map((f) => <form key={f.key} action={A.setFlag} className="flex items-center gap-3 text-sm mb-2"><input type="hidden" name="key" value={f.key} /><input type="hidden" name="enabled" value={f.enabled ? "0" : "1"} /><code className="flex-1">{f.key}</code><span className={f.enabled ? "text-green-400" : "text-muted"}>{f.enabled ? "AÇIK" : "KAPALI"}</span><button className="btn btn-ghost py-1 text-xs">{f.enabled ? "Kapat" : "Aç"}</button></form>)}
      <p className="text-xs text-yellow-300 mt-2">⚠️ store_enabled: hukuki inceleme olmadan açmayın.</p>
    </Box>
    <Box title="Site ayarları">
      {settings.map((st) => <form key={st.key} action={A.saveSetting} className="flex gap-2 mb-2"><input type="hidden" name="key" value={st.key} /><code className="w-28 text-xs pt-2">{st.key}</code><textarea name="value" defaultValue={st.value} className="input min-h-10" /><button className="btn btn-ghost">Kaydet</button></form>)}
    </Box>
  </>);
}

async function Audit() {
  const rows = await db.select({ a: auditLogs, username: profiles.username }).from(auditLogs).leftJoin(profiles, eq(profiles.id, auditLogs.actorId)).orderBy(desc(auditLogs.id)).limit(100);
  return (
    <Box title="Audit log (son 100)">
      <div className="text-xs space-y-1 font-mono">{rows.map(({ a, username }) => <div key={a.id} className="flex gap-2 border-b border-line/50 py-1"><span className="text-muted w-36 shrink-0">{a.createdAt.toLocaleString("tr-TR")}</span><span className="w-24 shrink-0 truncate">{username ?? "-"}</span><span className="text-accent2 w-44 shrink-0 truncate">{a.action}</span><span className="truncate text-muted">{a.newValue ? JSON.stringify(a.newValue) : ""}</span><span className="ml-auto text-muted">{a.ip}</span></div>)}</div>
    </Box>
  );
}

function Security({ username, secret, enabled, verified }: { username: string; secret: string | null; enabled: boolean; verified: boolean }) {
  return (
    <Box title="İki adımlı doğrulama (TOTP)">
      {enabled && verified && <p className="text-green-400 text-sm">✓ 2FA aktif ve bu oturum doğrulandı.</p>}
      {!secret && !enabled && <form action={A.totpSetup}><p className="text-sm text-muted mb-2">Google Authenticator / Authy gibi bir uygulama ile 2FA kur.</p><button className="btn btn-red">2FA kurulumunu başlat</button></form>}
      {secret && (!enabled || !verified) && (
        <form action={A.totpVerify} className="space-y-2 max-w-md">
          {!enabled && <><p className="text-sm">Bu anahtarı authenticator uygulamana ekle:</p><code className="block bg-black/40 p-2 rounded break-all">{secret}</code><code className="block text-[10px] text-muted break-all">{otpauthUrl(username, secret)}</code></>}
          <input name="code" className="input" placeholder="6 haneli kod" inputMode="numeric" maxLength={6} />
          <button className="btn btn-red">{enabled ? "Doğrula" : "Etkinleştir"}</button>
        </form>
      )}
    </Box>
  );
}

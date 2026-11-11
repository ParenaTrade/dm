"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, fmt } from "@/lib/client";
import Chat from "./Chat";
import AuthModal from "./AuthModal";

export type Me = { id: string; username: string; level: number; xp: number; coinBalance: number; role: string };
type Note = { id: number; title: string; message: string; isRead: boolean; createdAt: string };
type Ledger = { id: number; delta: number; reason: string; createdAt: string };

const Ctx = createContext<{ me: Me | null; refresh: () => void; openAuth: () => void }>({ me: null, refresh: () => {}, openAuth: () => {} });
export const useMe = () => useContext(Ctx);

const NAV: { href: string; label: string; icon: string; flag?: "store"; staff?: boolean }[] = [
  { href: "/", label: "Lobi", icon: "🏠" },
  { href: "/yayin/cenkbey", label: "Canlı Yayın", icon: "🔴" },
  { href: "/sponsors", label: "Sponsorlar", icon: "🤝" },
  { href: "/originals", label: "Originals", icon: "🎲" },
  { href: "/oyun-secici", label: "Oyun Seçici", icon: "🎰" },
  { href: "/store", label: "Store", icon: "🛍️", flag: "store" },
  { href: "/promotions", label: "Promosyonlar", icon: "🎁" },
  { href: "/tournaments", label: "Turnuvalar", icon: "🏆" },
  { href: "/bets", label: "Tahminler", icon: "📊" },
  { href: "/quests", label: "Görevler", icon: "🎯" },
  { href: "/claims", label: "Ödüller", icon: "💰" },
  { href: "/ask", label: "Cenk'e Sor", icon: "❓" },
  { href: "/about", label: "Hakkında", icon: "👤" },
];

export default function Shell({ children, initialUser, ageOk, storeOn, supportUrl }: { children: ReactNode; initialUser: Me | null; ageOk: boolean; storeOn: boolean; supportUrl: string }) {
  const [me, setMe] = useState<Me | null>(initialUser);
  const [notes, setNotes] = useState<Note[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [menu, setMenu] = useState<"" | "coin" | "bell" | "user">("");
  const [auth, setAuth] = useState(false);
  const [search, setSearch] = useState(false);
  const [age, setAge] = useState(ageOk);
  const path = usePathname();
  const router = useRouter();

  const refresh = useCallback(() => {
    api<{ user: Me | null; notifications?: Note[]; ledger?: Ledger[] }>("/api/me").then((d) => {
      setMe(d.user); setNotes(d.notifications ?? []); setLedger(d.ledger ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { setNavOpen(false); setMenu(""); }, [path]);
  useEffect(() => {
    const saved = localStorage.getItem("chatOpen"); if (saved) setChatOpen(saved === "1");
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); } if (e.key === "Escape") setSearch(false); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  const toggleChat = () => { setChatOpen((v) => { localStorage.setItem("chatOpen", v ? "0" : "1"); return !v; }); };
  const unread = notes.filter((n) => !n.isRead).length;
  const isStream = path.startsWith("/yayin/");

  const logout = async () => { await api("/api/auth", { action: "logout" }); setMe(null); router.refresh(); };

  return (
    <Ctx.Provider value={{ me, refresh, openAuth: () => setAuth(true) }}>
      <div className="flex h-screen overflow-hidden">
        {/* Sol menü */}
        <aside className={`fixed z-40 inset-y-0 left-0 w-60 bg-panel border-r border-line flex flex-col transition-transform lg:static lg:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <Link href="/" className="h-16 flex items-center gap-2 px-5 border-b border-line">
            <span className="w-8 h-8 rounded-lg bg-accent grid place-items-center font-black">C</span>
            <span className="font-black text-lg tracking-tight">CENK<span className="text-accent">BEY</span></span>
          </Link>
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {NAV.filter((n) => n.flag !== "store" || storeOn || me?.role === "admin").map((n) => {
              const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${active ? "bg-accent/15 text-white border-l-2 border-accent" : "text-muted hover:text-white hover:bg-white/5"}`}>
                  <span className="w-5 text-center">{n.icon}</span>{n.label}
                </Link>
              );
            })}
            {me && (me.role === "admin" || me.role === "host" || me.role === "mod") && <div className="pt-3 mt-3 border-t border-line text-[10px] uppercase text-muted px-3">Yönetim</div>}
            {me && (me.role === "admin" || me.role === "host") && <Link href="/studio" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:text-white hover:bg-white/5"><span className="w-5 text-center">🎥</span>Stüdyo</Link>}
            {me?.role === "admin" && <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:text-white hover:bg-white/5"><span className="w-5 text-center">⚙️</span>Admin</Link>}
          </nav>
          <div className="p-3 text-[10px] text-muted border-t border-line leading-relaxed">18+ · Coin'ler sanaldır, satın alınamaz ve nakde çevrilemez. Sorumlu eğlen.</div>
        </aside>
        {navOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setNavOpen(false)} />}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Üst bar */}
          <header className="h-16 shrink-0 border-b border-line bg-panel/80 backdrop-blur flex items-center gap-3 px-4">
            <button className="lg:hidden btn-ghost btn px-3" onClick={() => setNavOpen(true)} aria-label="Menü">☰</button>
            <button onClick={() => setSearch(true)} className="hidden md:flex items-center gap-2 input max-w-xs text-muted text-left">🔍 Ara… <kbd className="ml-auto text-[10px] border border-line rounded px-1">Ctrl K</kbd></button>
            <div className="flex-1" />
            {me ? (
              <>
                <div className="relative">
                  <button onClick={() => setMenu(menu === "coin" ? "" : "coin")} className="btn btn-ghost">🪙 <span className="tabular-nums">{fmt(me.coinBalance)}</span> ▾</button>
                  {menu === "coin" && (
                    <div className="absolute right-0 mt-2 w-72 card p-3 z-50 shadow-2xl">
                      <div className="text-xs text-muted">Sanal coin bakiyesi</div>
                      <div className="text-2xl font-bold">🪙 {fmt(me.coinBalance)}</div>
                      <div className="text-xs text-muted mt-1">Seviye {me.level} · {me.xp % 100}/100 XP</div>
                      <div className="h-1.5 bg-line rounded mt-1"><div className="h-full bg-accent rounded" style={{ width: `${me.xp % 100}%` }} /></div>
                      <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                        {ledger.map((l) => <div key={l.id} className="flex justify-between text-xs"><span className="text-muted">{l.reason}</span><span className={l.delta >= 0 ? "text-green-400" : "text-red-400"}>{l.delta > 0 ? "+" : ""}{fmt(l.delta)}</span></div>)}
                      </div>
                      <p className="text-[10px] text-muted mt-3">Coin yalnızca aktiviteyle kazanılır (izleme, görev, turnuva). Nakit değeri yoktur.</p>
                      <Link href="/claims" className="btn btn-red w-full mt-2">Ödülleri topla</Link>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button onClick={() => { setMenu(menu === "bell" ? "" : "bell"); if (unread) api("/api/me", { action: "mark_read" }).then(refresh); }} className="btn btn-ghost px-3 relative" aria-label="Bildirimler">
                    🔔{unread > 0 && <span className="absolute -top-1 -right-1 bg-accent text-[10px] rounded-full w-4 h-4 grid place-items-center">{unread}</span>}
                  </button>
                  {menu === "bell" && (
                    <div className="absolute right-0 mt-2 w-80 card p-2 z-50 shadow-2xl max-h-96 overflow-y-auto">
                      {notes.length === 0 && <div className="p-4 text-sm text-muted text-center">Bildirim yok</div>}
                      {notes.map((n) => <div key={n.id} className="p-2 rounded hover:bg-white/5"><div className="text-sm font-semibold">{n.title}</div><div className="text-xs text-muted">{n.message}</div></div>)}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button onClick={() => setMenu(menu === "user" ? "" : "user")} className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-orange-500 grid place-items-center font-bold uppercase">{me.username[0]}</span>
                  </button>
                  {menu === "user" && (
                    <div className="absolute right-0 mt-2 w-52 card p-2 z-50 shadow-2xl text-sm">
                      <div className="px-2 py-1 font-semibold">{me.username} <span className="badge bg-accent/20 text-accent2">Lv {me.level}</span></div>
                      <Link href="/profile" className="block px-2 py-1.5 rounded hover:bg-white/5">Profil & Gizlilik</Link>
                      <Link href="/originals/verify" className="block px-2 py-1.5 rounded hover:bg-white/5">Adil oyun doğrulama</Link>
                      <button onClick={logout} className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-red-400">Çıkış yap</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button className="btn btn-red" onClick={() => setAuth(true)}>Giriş / Kayıt</button>
            )}
            {!isStream && <button onClick={toggleChat} className="btn btn-ghost px-3" title="Sohbet aç/kapa">💬</button>}
          </header>

          <div className="flex-1 flex min-h-0">
            <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
            {!isStream && chatOpen && (
              <aside className="hidden xl:flex w-80 shrink-0 border-l border-line bg-panel flex-col">
                <div className="h-12 flex items-center justify-between px-4 border-b border-line font-semibold text-sm">Site Sohbeti <button onClick={toggleChat} className="text-muted hover:text-white">✕</button></div>
                <Chat room="site" />
              </aside>
            )}
          </div>
        </div>
      </div>

      <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="fixed bottom-5 right-5 z-30 w-12 h-12 rounded-full bg-accent shadow-lg grid place-items-center text-xl hover:scale-105 transition" title="Destek">🎧</a>
      {auth && <AuthModal onClose={() => setAuth(false)} onDone={() => { setAuth(false); refresh(); router.refresh(); }} />}
      {search && <SearchModal onClose={() => setSearch(false)} />}
      {!age && <AgeGate onOk={async () => { await api("/api/me", { action: "confirm_age" }); setAge(true); }} />}
    </Ctx.Provider>
  );
}

function AgeGate({ onOk }: { onOk: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 grid place-items-center p-4">
      <div className="card p-8 max-w-md text-center">
        <div className="text-5xl mb-3">🔞</div>
        <h2 className="text-xl font-bold">Yaş Doğrulaması</h2>
        <p className="text-sm text-muted mt-2">Bu platform sponsor içerikleri barındırır ve yalnızca <b>18 yaş ve üzeri</b> kullanıcılar içindir. Devam ederek 18 yaşından büyük olduğunu onaylarsın.</p>
        <p className="text-xs text-muted mt-2">Platform içi coin'ler sanaldır; satın alınamaz, nakde çevrilemez.</p>
        <div className="flex gap-2 mt-5">
          <a href="https://www.google.com" className="btn btn-ghost flex-1">Çıkış</a>
          <button onClick={onOk} className="btn btn-red flex-1">18 yaşından büyüğüm</button>
        </div>
      </div>
    </div>
  );
}

const PAGES = NAV.map((n) => ({ label: n.label, href: n.href, kind: "Sayfa" }));
function SearchModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ label: string; href: string; kind: string }[]>([]);
  const router = useRouter();
  useEffect(() => {
    const pages = PAGES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase()));
    if (!q) { setRes(pages); return; }
    const t = setTimeout(() => api<{ results: typeof res }>(`/api/search?q=${encodeURIComponent(q)}`).then((d) => setRes([...pages, ...d.results])).catch(() => setRes(pages)), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-24 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-3" onClick={(e) => e.stopPropagation()}>
        <input autoFocus className="input" placeholder="Sayfa, kanal veya sponsor ara…" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && res[0]) { router.push(res[0].href); onClose(); } }} />
        <div className="mt-2 max-h-80 overflow-y-auto">
          {res.map((r) => <button key={r.href + r.label} onClick={() => { router.push(r.href); onClose(); }} className="w-full flex justify-between px-3 py-2 rounded hover:bg-white/5 text-sm"><span>{r.label}</span><span className="text-muted text-xs">{r.kind}</span></button>)}
        </div>
      </div>
    </div>
  );
}

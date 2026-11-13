"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ROLE_LABELS, roleBadgeClass, type ChatMessageInfo, type ModeratorInfo } from "@/lib/types";

type PanelUser = {
  id: number;
  nickname: string;
  role: string;
  mutedUntil: string | null;
  bannedUntil: string | null;
  messageCount: number;
};

type LogEntry = { id: number; actor: string; action: string; target: string; createdAt: string };

type Tab = "mods" | "users" | "deleted" | "logs";

export function PanelClient() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [nickname, setNickname] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mods");

  const [mods, setMods] = useState<ModeratorInfo[]>([]);
  const [users, setUsers] = useState<PanelUser[]>([]);
  const [deleted, setDeleted] = useState<ChatMessageInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [modInput, setModInput] = useState("");
  const [search, setSearch] = useState("");

  const loadAll = useCallback(async () => {
    const [modsRes, panelRes] = await Promise.all([
      fetch("/api/moderators", { cache: "no-store" }),
      fetch("/api/panel", { cache: "no-store" }),
    ]);
    if (panelRes.status === 403) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    const modsData = await modsRes.json();
    const panelData = await panelRes.json();
    setMods(modsData.moderators ?? []);
    setUsers(panelData.users ?? []);
    setDeleted(
      (panelData.deletedMessages ?? []).map((m: Omit<ChatMessageInfo, "role" | "accent" | "status" | "isPinned">) => ({
        ...m,
        role: "viewer",
        accent: "#a855f7",
        status: "deleted",
        isPinned: false,
      })),
    );
    setLogs(panelData.logs ?? []);
    setAllowed(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
    const timer = setInterval(() => void loadAll(), 6000);
    return () => clearInterval(timer);
  }, [loadAll]);

  const login = async () => {
    setError(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, hostPassword }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error ?? "Giriş başarısız");
      return;
    }
    if (data.user.role !== "host" && data.user.role !== "moderator") {
      setError("Bu panele girmek için yayıncı veya moderatör olmalısın. (Demo yayıncı şifresi: berkbey)");
      return;
    }
    await loadAll();
  };

  const addModerator = async () => {
    if (!modInput.trim()) return;
    const res = await fetch("/api/moderators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: modInput.trim(), note: "Panelden eklendi" }),
    });
    const data = await res.json();
    setNotice(data.ok ? `${modInput.trim()} moderatör oldu. 🛡` : data.error ?? "Eklenemedi");
    if (data.ok) setModInput("");
    await loadAll();
  };

  const removeModerator = async (id: number) => {
    await fetch(`/api/moderators?id=${id}`, { method: "DELETE" });
    setNotice("Moderatör kadrodan çıkarıldı.");
    await loadAll();
  };

  const setUserAction = async (action: string, userId: number) => {
    const res = await fetch("/api/panel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId }),
    });
    const data = await res.json();
    setNotice(data.ok ? "İşlem tamam." : data.error ?? "İşlem başarısız");
    await loadAll();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="glass animate-pulse rounded-3xl px-10 py-8">Panel yükleniyor...</div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass neon-ring w-full max-w-md rounded-3xl p-7">
          <p className="font-display gold-text text-3xl">Moderatör Paneli</p>
          <p className="mt-2 text-sm text-white/60">
            Yayıncı şifresi ile giriş yap (demo: <span className="text-gold">berkbey</span>) ya da moderatör hesabınla
            devam et.
          </p>
          <div className="mt-5 space-y-3">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Takma ad"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-gold/50"
            />
            <input
              value={hostPassword}
              onChange={(e) => setHostPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void login()}
              type="password"
              placeholder="Yayıncı şifresi"
              className="w-full rounded-xl border border-gold/30 bg-black/40 px-4 py-3 outline-none focus:border-gold"
            />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <button onClick={() => void login()} className="btn-gold w-full rounded-xl py-3 font-bold">
              Giriş Yap
            </button>
            <Link href="/canli" className="block text-center text-xs text-white/45 hover:text-gold">
              ← Stüdyoya dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => u.nickname.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display gold-text text-4xl">Moderatör Paneli</p>
          <p className="text-sm text-white/55">Kadro yönetimi, kullanıcı denetimi ve olay kaydı</p>
        </div>
        <div className="flex gap-2">
          <Link href="/canli" className="btn-gold rounded-full px-5 py-2.5 text-sm font-bold">
            ▶ Stüdyoya Git
          </Link>
          <Link href="/durum" className="btn-ghost rounded-full px-5 py-2.5 text-sm">
            Sistem Durumu
          </Link>
          <Link href="/" className="btn-ghost rounded-full px-5 py-2.5 text-sm">
            Ana Sayfa
          </Link>
        </div>
      </div>

      {notice && (
        <p className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-goldsoft">{notice}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["mods", `🛡 Moderatörler (${mods.length})`],
            ["users", `👥 Kullanıcılar (${users.length})`],
            ["deleted", `🗑 Silinen Mesajlar (${deleted.length})`],
            ["logs", `📜 Olaylar (${logs.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              tab === key ? "bg-gold text-black font-bold" : "btn-ghost text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "mods" && (
          <div className="space-y-4">
            <div className="glass-dark flex flex-wrap gap-2 rounded-2xl p-4">
              <input
                value={modInput}
                onChange={(e) => setModInput(e.target.value)}
                placeholder="Moderatör ekle: takma ad yaz (örn. AyseMod)"
                className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-cyan-400/50"
              />
              <button onClick={() => void addModerator()} className="btn-gold rounded-xl px-5 py-3 text-sm font-bold">
                🛡 Moderatör Ekle
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {mods.map((m) => (
                <div key={m.id} className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-lg">🛡</span>
                      <div>
                        <p className="font-bold">{m.nickname}</p>
                        <p className="text-xs text-white/45">
                          Ekleyen: {m.addedBy} · {new Date(m.createdAt).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => void removeModerator(m.id)}
                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/40"
                    >
                      Kadrodan çıkar
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-white/50">{m.note || "Not eklenmedi"}</p>
                </div>
              ))}
              {mods.length === 0 && <p className="text-sm text-white/50">Henüz moderatör yok.</p>}
            </div>
          </div>
        )}

        {tab === "users" && (
          <div className="glass-dark rounded-2xl p-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kullanıcı ara..."
              className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm outline-none focus:border-gold/50"
            />
            <div className="space-y-2">
              {filteredUsers.map((u) => {
                const muted = u.mutedUntil && new Date(u.mutedUntil).getTime() > Date.now();
                const banned = u.bannedUntil && new Date(u.bannedUntil).getTime() > Date.now();
                return (
                  <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${roleBadgeClass(u.role)}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                      <span className="font-semibold">{u.nickname}</span>
                      <span className="text-xs text-white/40">{u.messageCount} mesaj</span>
                      {muted && <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">SUSTURULMUŞ</span>}
                      {banned && <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300">UZAKLAŞTIRILMIŞ</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => void setUserAction("promote", u.id)} className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs hover:bg-cyan-500/40">
                        Mod yap
                      </button>
                      <button onClick={() => void setUserAction("demote", u.id)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">
                        İzleyiciye düşür
                      </button>
                      <button onClick={() => void setUserAction("unban", u.id)} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs hover:bg-emerald-500/40">
                        Yasağı kaldır
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "deleted" && (
          <div className="glass-dark space-y-2 rounded-2xl p-4">
            {deleted.map((m) => (
              <div key={m.id} className="rounded-xl bg-white/5 px-4 py-3 text-sm">
                <span className="font-bold text-white/70">{m.nickname}</span>
                <span className="text-white/40"> · {new Date(m.createdAt).toLocaleTimeString("tr-TR")}</span>
                <p className="mt-1 italic text-white/50">{m.body}</p>
              </div>
            ))}
            {deleted.length === 0 && <p className="text-sm text-white/50">Silinen mesaj yok. Sohbet tertemiz. ✨</p>}
          </div>
        )}

        {tab === "logs" && (
          <div className="glass-dark space-y-2 rounded-2xl p-4">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-bold text-gold">{l.actor}</span>{" "}
                  <span className="text-white/60">{l.action}</span> <span className="text-cyan-300">{l.target}</span>
                </span>
                <span className="text-xs text-white/35">{new Date(l.createdAt).toLocaleString("tr-TR")}</span>
              </div>
            ))}
            {logs.length === 0 && <p className="text-sm text-white/50">Henüz kayıt yok.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

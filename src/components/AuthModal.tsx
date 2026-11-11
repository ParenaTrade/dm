"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export default function AuthModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [birthYear, setB] = useState("");
  const [ageConfirm, setA] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await api("/api/auth", mode === "login" ? { action: "login", username, password } : { action: "register", username, password, birthYear: Number(birthYear), ageConfirm });
      onDone();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={onClose}>
      <form onSubmit={submit} className="card p-6 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2">
          {(["login", "register"] as const).map((m) => <button type="button" key={m} onClick={() => setMode(m)} className={`btn flex-1 ${mode === m ? "btn-red" : "btn-ghost"}`}>{m === "login" ? "Giriş" : "Kayıt ol"}</button>)}
        </div>
        <div><label className="label">Kullanıcı adı</label><input className="input" value={username} onChange={(e) => setU(e.target.value)} required /></div>
        <div><label className="label">Şifre</label><input className="input" type="password" value={password} onChange={(e) => setP(e.target.value)} required /></div>
        {mode === "register" && <>
          <div><label className="label">Doğum yılı</label><input className="input" type="number" value={birthYear} onChange={(e) => setB(e.target.value)} placeholder="1995" required /></div>
          <label className="flex gap-2 text-xs text-muted"><input type="checkbox" checked={ageConfirm} onChange={(e) => setA(e.target.checked)} /> 18 yaşından büyük olduğumu ve coin'lerin sanal olduğunu (satın alınamaz, nakde çevrilemez) onaylıyorum.</label>
        </>}
        {err && <div className="text-sm text-red-400">{err}</div>}
        <button disabled={busy} className="btn btn-red w-full">{busy ? "…" : mode === "login" ? "Giriş yap" : "Hesap oluştur"}</button>
        <p className="text-[11px] text-muted text-center">Demo: <b>cenkbey / admin123</b> (admin+yayıncı) · <b>izleyici / demo123</b></p>
      </form>
    </div>
  );
}

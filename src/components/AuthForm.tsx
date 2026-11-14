"use client";

import { useState } from "react";
import {
  authConfigured,
  checkEmail,
  checkNickname,
  exchangeSession,
  resendConfirmation,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/auth-client";
import type { AppUser } from "@/lib/types";

type Step = "email" | "login" | "register" | "sent";

const input =
  "w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-gold/60";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-posta gir → kayıtlıysa şifre ile giriş, değilse kayıt formu → e-posta onayı. */
export function AuthForm({ onDone }: { onDone: (user: AppUser) => void }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  const cleanEmail = email.trim().toLowerCase();

  const fail = (msg: string) => {
    setError(msg);
    setBusy(false);
  };

  const next = async () => {
    setError(null);
    setInfo(null);
    if (!EMAIL_RE.test(cleanEmail)) return fail("Geçerli bir e-posta adresi gir.");
    setBusy(true);
    const exists = await checkEmail(cleanEmail);
    setBusy(false);
    setStep(exists === false ? "register" : "login");
    if (exists === false) setInfo("Bu e-posta için kayıt görünmüyor. Daha önce kayıt olduysan aşağıdan \"giriş yap\"a tıkla, yoksa formu doldur.");
  };

  const register = async () => {
    setError(null);
    if (name.trim().length < 3 || !name.trim().includes(" ")) return fail("Ad ve soyadını birlikte yaz.");
    const nick = nickname.trim();
    if (nick.length < 3 || nick.length > 20 || nick.includes("@")) {
      return fail("Rumuz 3-20 karakter olmalı ve @ içermemeli.");
    }
    if (password.length < 8) return fail("Şifre en az 8 karakter olmalı.");
    setBusy(true);
    if ((await checkNickname(nick)) === true) return fail("Bu rumuz kullanılıyor, başka bir rumuz seç.");
    // Hesap Supabase'de zaten varsa (uygulamaya henüz girmemiş olabilir) önce giriş dene.
    const existing = await signInWithEmail(cleanEmail, password);
    if (existing.ok) return void (await finish());
    if (existing.unconfirmed) {
      setBusy(false);
      setStep("sent");
      return;
    }
    const res = await signUpWithEmail({ name: name.trim(), nickname: nick, email: cleanEmail, password });
    if (res.error) {
      if (res.error.includes("zaten kayıt")) {
        setBusy(false);
        setStep("login");
        setPassword("");
        setInfo("Bu e-posta zaten kayıtlı. Şifrenle giriş yap.");
        return;
      }
      return fail(res.error);
    }
    if (res.needsConfirm) {
      setBusy(false);
      setStep("sent");
      return;
    }
    await finish();
  };

  const login = async () => {
    setError(null);
    setUnconfirmed(false);
    if (!password) return fail("Şifreni yaz.");
    setBusy(true);
    const res = await signInWithEmail(cleanEmail, password);
    if (!res.ok) {
      setUnconfirmed(Boolean(res.unconfirmed));
      return fail(res.error ?? "Giriş başarısız.");
    }
    await finish();
  };

  const finish = async () => {
    const ex = await exchangeSession();
    if (ex?.user) {
      setBusy(false);
      onDone(ex.user);
    } else {
      fail(ex?.error ?? "Oturum açılamadı.");
    }
  };

  const resend = async () => {
    setError(null);
    const err = await resendConfirmation(cleanEmail);
    if (err) setError(err);
    else setInfo("Onay e-postası tekrar gönderildi. Spam klasörünü de kontrol et.");
  };

  if (!authConfigured) {
    return (
      <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-200">
        Kayıt sistemi henüz yapılandırılmamış (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY eksik).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {step === "sent" ? (
        <div className="space-y-3 text-center">
          <p className="text-4xl">📧</p>
          <p className="font-semibold">Onay e-postası gönderildi</p>
          <p className="text-sm text-white/65">
            <span className="text-gold">{cleanEmail}</span> adresine gelen bağlantıya tıklayarak hesabını onayla.
            Onaylayınca bu sayfaya yönlendirilir ve otomatik giriş yaparsın.
          </p>
          <button onClick={() => void resend()} className="btn-ghost w-full rounded-xl py-2.5 text-sm">
            Onay e-postasını tekrar gönder
          </button>
          <button
            onClick={() => {
              setStep("login");
              setError(null);
              setInfo(null);
            }}
            className="w-full text-xs text-white/50 hover:text-gold"
          >
            Onayladım, giriş yap
          </button>
        </div>
      ) : (
        <>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={step !== "email"}
            placeholder="E-posta adresin"
            className={`${input} ${step !== "email" ? "opacity-70" : ""}`}
            onKeyDown={(e) => e.key === "Enter" && step === "email" && void next()}
          />

          {step === "register" && (
            <>
              <input
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ad Soyad (gizli kalır)"
                className={input}
              />
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                placeholder="Rumuz (sohbette herkes bunu görür)"
                className={input}
              />
            </>
          )}

          {step !== "email" && (
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                autoComplete={step === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={step === "register" ? "Şifre (en az 8 karakter)" : "Şifre"}
                className={`${input} pr-16`}
                onKeyDown={(e) => e.key === "Enter" && void (step === "register" ? register() : login())}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/50 hover:text-gold"
              >
                {showPass ? "Gizle" : "Göster"}
              </button>
            </div>
          )}

          {info && <p className="text-sm text-emerald-300">{info}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
          {unconfirmed && (
            <button onClick={() => void resend()} className="text-sm text-gold underline">
              Onay e-postasını tekrar gönder
            </button>
          )}

          {step === "email" && (
            <button onClick={() => void next()} disabled={busy} className="btn-gold w-full rounded-xl py-3 font-bold disabled:opacity-60">
              {busy ? "Kontrol ediliyor…" : "Devam Et"}
            </button>
          )}
          {step === "login" && (
            <>
              <button onClick={() => void login()} disabled={busy} className="btn-gold w-full rounded-xl py-3 font-bold disabled:opacity-60">
                {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
              </button>
              <button
                onClick={() => {
                  setStep("register");
                  setError(null);
                  setInfo(null);
                }}
                className="w-full text-xs text-white/50 hover:text-gold"
              >
                Hesabın yok mu? Kayıt ol
              </button>
            </>
          )}
          {step === "register" && (
            <>
              <button onClick={() => void register()} disabled={busy} className="btn-gold w-full rounded-xl py-3 font-bold disabled:opacity-60">
                {busy ? "Kaydediliyor…" : "Kaydet ve E-postamı Onayla"}
              </button>
              <button
                onClick={() => {
                  setStep("login");
                  setError(null);
                  setInfo(null);
                }}
                className="w-full text-xs text-white/50 hover:text-gold"
              >
                Zaten hesabım var, giriş yap
              </button>
            </>
          )}
          {step !== "email" && (
            <button
              onClick={() => {
                setStep("email");
                setPassword("");
                setError(null);
                setInfo(null);
              }}
              className="w-full text-xs text-white/35 hover:text-gold"
            >
              Farklı e-posta kullan
            </button>
          )}
        </>
      )}
    </div>
  );
}

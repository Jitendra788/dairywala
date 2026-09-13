"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { login, logout } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { AuthLangBar } from "@/components/language-switch";
import { useI18n } from "@/hooks/use-i18n";
import { btnGhost, btnPrimary, Card, Field, inputClass } from "@/components/ui";

export function LoginScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { loggedIn, username: sessionUser, isAdmin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get("email");
    if (email) setUsername(email);
  }, []);

  async function finish(user: string, pass: string, next: string) {
    setError("");
    setBusy(true);
    try {
      if (loggedIn) logout();
      await login(user, pass, remember);
      router.replace(next);
    } catch (err) {
      const extra = err as { needVerify?: boolean; email?: string };
      if (extra.needVerify && extra.email) {
        router.replace(`/verify?email=${encodeURIComponent(extra.email)}`);
        return;
      }
      setError(err instanceof Error ? err.message : t("loginFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = username.trim().toLowerCase() === "admin" ? "/admin" : "/";
    await finish(username, password, next);
  }

  return (
    <div className="relative z-10 h-dvh overflow-y-auto bg-background">
      <AuthLangBar />
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-6 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
        <div className="mb-6 text-center sm:mb-8">
          <img
            src="/dairy-logo.png"
            alt="DudhSetu"
            className="mx-auto h-16 w-16 rounded-3xl object-contain shadow-[0_10px_30px_rgba(24,122,72,0.35)] sm:h-[72px] sm:w-[72px]"
          />
          <h1 className="mt-3 font-display text-[28px] leading-none sm:mt-4 sm:text-3xl">DudhSetu</h1>
          <p className="mt-2 text-[13px] text-muted sm:text-sm">
            {t("loginHint")}
          </p>
        </div>

        <Card className="p-4 sm:p-5">
          {loggedIn ? (
            <div className="mb-3 rounded-xl bg-[#f7f1e6] px-3 py-2 text-[13px] text-muted">
              {t("loggedInAs")}: <b className="text-foreground">{sessionUser}</b>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={btnGhost} onClick={() => router.replace(isAdmin ? "/admin" : "/")}>
                  {t("continue")}
                </button>
                <button type="button" className={btnGhost} onClick={() => logout()}>
                  {t("logout")}
                </button>
              </div>
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-3">
            <Field label={t("emailUsername")}>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
                <input
                  className={`${inputClass} pl-9`}
                  autoComplete="username"
                  inputMode="email"
                  placeholder="dairy@email.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </Field>
            <Field label={t("password")}>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
                <input
                  className={`${inputClass} pr-12 pl-9`}
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-1.5 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? t("hidePassword") : t("showPassword")}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-[13px] text-muted sm:min-h-0 sm:text-sm">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              {t("rememberDevice")}
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button type="submit" className={`${btnPrimary} min-h-12 w-full py-3`} disabled={busy || !username || !password}>
              {busy ? t("checking") : t("login")}
            </button>
          </form>
          <p className="mt-3 text-center text-[13px]">
            <Link href="/forgot" className="font-semibold text-primary hover:underline">
              {t("forgotPassword")}
            </Link>
          </p>
          <p className="mt-4 text-center text-[13px] text-muted">
            {t("newDairy")}{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              {t("signupOtp")}
            </Link>
            {" · "}
            <Link href="/verify" className="font-semibold text-primary hover:underline">
              {t("otpVerify")}
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

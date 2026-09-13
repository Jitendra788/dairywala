"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { requestPasswordReset, resetAccountPassword } from "@/lib/auth";
import { AuthLangBar } from "@/components/language-switch";
import { useI18n } from "@/hooks/use-i18n";
import { btnGhost, btnPrimary, Card, Field, inputClass } from "@/components/ui";

export function ForgotScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await requestPasswordReset(email);
      setSent(true);
      setCode("");
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("otpFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await resetAccountPassword(email, code, password);
      router.replace(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("resetFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 h-dvh overflow-y-auto bg-background">
      <AuthLangBar />
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-6 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
        <div className="mb-6 text-center">
          <img src="/dairy-logo.png" alt="DudhSetu" className="mx-auto h-16 w-16 rounded-3xl object-contain" />
          <h1 className="mt-3 font-display text-[28px] leading-none">{t("forgotTitle")}</h1>
          <p className="mt-2 text-[13px] text-muted">{t("forgotHint")}</p>
        </div>
        <Card className="p-4 sm:p-5">
          {!sent ? (
            <form onSubmit={sendOtp} className="space-y-3">
              <Field label={t("email")}>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
                  <input
                    className={`${inputClass} pl-9`}
                    type="email"
                    autoComplete="email"
                    placeholder="dairy@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <button type="submit" className={`${btnPrimary} min-h-12 w-full`} disabled={busy || !email}>
                {busy ? t("sending") : t("sendOtp")}
              </button>
            </form>
          ) : (
            <form onSubmit={savePassword} className="space-y-3" autoComplete="off">
              {message ? <p className="rounded-xl bg-[#f7f1e6] px-3 py-2 text-[13px] text-muted">{message}</p> : null}
              <Field label={t("otp")}>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6 digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              <Field label={t("newPassword")}>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
                  <input
                    className={`${inputClass} pl-9`}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <button type="submit" className={`${btnPrimary} min-h-12 w-full`} disabled={busy || !code || !password}>
                {busy ? t("save") : t("changePassword")}
              </button>
              <button type="button" className={`${btnGhost} w-full`} disabled={busy} onClick={() => void sendOtp({ preventDefault() {} } as React.FormEvent)}>
                {t("resendOtp")}
              </button>
            </form>
          )}
          <p className="mt-4 text-center text-[13px] text-muted">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              {t("backToLogin")}
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

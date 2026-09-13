"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resendVerifyCode, verifyAccount } from "@/lib/auth";
import { AuthLangBar } from "@/components/language-switch";
import { useI18n } from "@/hooks/use-i18n";
import { btnGhost, btnPrimary, Card, Field, inputClass } from "@/components/ui";

export function VerifyScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await verifyAccount(email, code.trim());
      router.replace(`/login?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("verifyFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError("");
    setBusy(true);
    try {
      const result = await resendVerifyCode(email);
      setCode("");
      setInfo(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("resendFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 h-dvh overflow-y-auto bg-background">
      <AuthLangBar />
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-6 pt-[max(3.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10">
        <div className="mb-6 text-center sm:mb-8">
          <img src="/dairy-logo.png" alt="DudhSetu" className="mx-auto h-16 w-16 rounded-3xl object-contain shadow-[0_10px_30px_rgba(24,122,72,0.35)]" />
          <h1 className="mt-3 font-display text-[28px] leading-none">{t("verifyTitle")}</h1>
          <p className="mt-2 text-[13px] text-muted">{t("verifyHint")}</p>
        </div>
        <Card className="p-4 sm:p-5">
          <form onSubmit={onSubmit} className="space-y-3" autoComplete="off">
            <Field label={t("email")}>
              <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t("verifyCode")}>
              <input
                className={inputClass}
                inputMode="numeric"
                autoComplete="off"
                name="otp-manual"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </Field>
            <p className="rounded-xl bg-[#f7f1e6] px-3 py-2 text-[12px] text-muted">{info || t("verifyInfo")}</p>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button type="submit" className={`${btnPrimary} min-h-12 w-full py-3`} disabled={busy || !email || code.length < 6}>
              {busy ? t("checking") : t("verifyOpen")}
            </button>
            <button type="button" className={`${btnGhost} min-h-11 w-full`} disabled={busy || !email} onClick={() => void onResend()}>
              {t("resendCode")}
            </button>
          </form>
          <p className="mt-4 text-center text-[13px] text-muted">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              {t("login")}
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

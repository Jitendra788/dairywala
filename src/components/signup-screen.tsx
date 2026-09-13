"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signupAccount } from "@/lib/auth";
import { DAIRY_CATEGORIES } from "@/lib/platform/types";
import { AuthLangBar } from "@/components/language-switch";
import { useI18n } from "@/hooks/use-i18n";
import { CATEGORY_KEYS } from "@/lib/i18n/dict";
import { btnPrimary, Card, Field, inputClass, Select } from "@/components/ui";

export function SignupScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dairyName, setDairyName] = useState("");
  const [category, setCategory] = useState<(typeof DAIRY_CATEGORIES)[number] | "">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await signupAccount({
        name,
        email,
        password,
        dairyName,
        category,
      });
      router.replace(`/verify?email=${encodeURIComponent(result.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("signupFailed"));
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
          <h1 className="mt-3 font-display text-[28px] leading-none">{t("signupTitle")}</h1>
          <p className="mt-2 text-[13px] text-muted">{t("signupHint")}</p>
        </div>
        <Card className="p-4 sm:p-5">
          <form onSubmit={onSubmit} className="space-y-3">
            <Field label={t("yourName")}>
              <input className={inputClass} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("email")}>
              <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t("password")}>
              <input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label={t("dairyName")}>
              <input className={inputClass} value={dairyName} onChange={(e) => setDairyName(e.target.value)} />
            </Field>
            <Field label={t("dairyCategory")}>
              <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                <option value="">{t("chooseCategory")}</option>
                {DAIRY_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {t(CATEGORY_KEYS[item] || "catOther")}
                  </option>
                ))}
              </Select>
            </Field>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button type="submit" className={`${btnPrimary} min-h-12 w-full py-3`} disabled={busy || !name || !email || !password || !dairyName || !category}>
              {busy ? t("creating") : t("sendVerify")}
            </button>
          </form>
          <p className="mt-4 text-center text-[13px] text-muted">
            {t("haveAccount")}{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              {t("login")}
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

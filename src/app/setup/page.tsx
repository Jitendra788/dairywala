"use client";

import { useRouter } from "next/navigation";
import { ProfileForm } from "@/components/dairy-brand";
import { AuthLangBar } from "@/components/language-switch";
import { useI18n } from "@/hooks/use-i18n";

export default function SetupPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="relative h-dvh overflow-y-auto bg-background">
      <AuthLangBar />
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">{t("dairyProfile")}</p>
        <h1 className="mt-1 font-display text-[28px] leading-tight">{t("setupTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("setupHint")}</p>
        <div className="mt-5 rounded-2xl border border-line bg-card p-4 shadow-[0_8px_30px_rgba(22,48,36,0.05)] sm:p-5">
          <ProfileForm
            submitLabel={t("setupSave")}
            onSaved={() => router.replace("/")}
          />
        </div>
      </div>
    </div>
  );
}

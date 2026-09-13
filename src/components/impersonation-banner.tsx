"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { stopImpersonation } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";

export function ImpersonationBanner() {
  const { impersonating, dairyName, name } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  if (!impersonating) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 bg-[#9a3412] px-3 py-1.5 text-[12px] text-white">
      <ShieldAlert size={14} />
      <span className="min-w-0 flex-1">
        {t("impersonation", { name: dairyName || name || "" })}
      </span>
      <button
        type="button"
        className="rounded-lg bg-white/15 px-2.5 py-1 font-semibold hover:bg-white/25"
        onClick={() => {
          stopImpersonation();
          router.replace("/admin/dairies");
        }}
      >
        {t("backToAdmin")}
      </button>
    </div>
  );
}

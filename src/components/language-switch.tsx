"use client";

import { useI18n } from "@/hooks/use-i18n";

export function LanguageSwitch({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useI18n();
  const base = dark
    ? "rounded-md px-2 py-0.5 text-[11px] font-semibold"
    : "rounded-md px-2 py-0.5 text-[11px] font-semibold";
  const on = dark ? "bg-white/20 text-white" : "bg-primary text-white";
  const off = dark ? "text-white/60 hover:text-white" : "text-muted hover:text-foreground";

  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg border ${dark ? "border-white/15" : "border-line"} p-0.5`} role="group" aria-label="Language">
      <button type="button" className={`${base} ${lang === "en" ? on : off}`} onClick={() => setLang("en")}>
        EN
      </button>
      <button type="button" className={`${base} ${lang === "hi" ? on : off}`} onClick={() => setLang("hi")}>
        हिं
      </button>
    </div>
  );
}

export function AuthLangBar() {
  return (
    <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-20">
      <LanguageSwitch />
    </div>
  );
}

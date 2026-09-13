"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";
import { UserMenu } from "@/components/user-menu";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { currentShift, formatDate, todayISO } from "@/lib/dates";
import { useDairy } from "@/hooks/use-dairy";
import { DairyLogo } from "@/components/dairy-brand";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/hooks/use-i18n";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [clock, setClock] = useState<{ date: string; morning: boolean } | null>(null);
  const { settings } = useDairy();
  const { t } = useI18n();
  const morning = clock?.morning ?? false;
  const dateLabel = clock ? formatDate(clock.date) : "—";

  useEffect(() => {
    setClock({ date: todayISO(), morning: currentShift() === "morning" });
    const mq = window.matchMedia("(max-width: 1279px) and (min-width: 1024px)");
    if (mq.matches) setCollapsed(true);
  }, []);

  return (
    <ToastProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <ImpersonationBanner />
        <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          open={open}
          collapsed={collapsed}
          onClose={() => setOpen(false)}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="relative z-30 flex min-h-14 shrink-0 items-center gap-1.5 border-b border-line bg-card px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:gap-3 sm:px-4">
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground lg:hidden"
              onClick={() => setOpen(true)}
              aria-label={t("openMenu")}
            >
              <Menu size={20} />
            </button>
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <DairyLogo settings={settings} size={28} className="rounded-xl" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{settings.dairyName || t("dairyDesk")}</p>
                <p className="text-[10px] text-muted">{dateLabel}</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <span className="rounded-full bg-[#f4ead6] px-2.5 py-1 text-[12px] text-foreground/80">
                {dateLabel}
              </span>
              {clock ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-primary">
                  {morning ? <Sun size={12} /> : <Moon size={12} />}
                  {morning ? t("morning") : t("evening")} {t("shift")}
                </span>
              ) : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold tracking-wide text-primary uppercase sm:inline-flex sm:px-2.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                {t("live")}
              </span>
              <LanguageSwitch />
              <UserMenu />
            </div>
          </header>
          <main className="relative z-0 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-6 pb-[max(16px,env(safe-area-inset-bottom))]">
            {children}
          </main>
        </div>
        </div>
      </div>
    </ToastProvider>
  );
}

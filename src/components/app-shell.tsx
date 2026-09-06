"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";
import { UserMenu } from "@/components/user-menu";
import { currentShift, formatDate, todayISO } from "@/lib/dates";
import { useDairy } from "@/hooks/use-dairy";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { settings } = useDairy();
  const morning = currentShift() === "morning";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px) and (min-width: 1024px)");
    if (mq.matches) setCollapsed(true);
  }, []);

  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar
          open={open}
          collapsed={collapsed}
          onClose={() => setOpen(false)}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="relative z-30 flex min-h-14 shrink-0 items-center gap-2 border-b border-line bg-card px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:gap-3 sm:px-4">
            <button
              type="button"
              className="rounded-lg p-1.5 text-foreground lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-[13px] font-medium">{settings.dairyName}</p>
              <p className="text-[10px] text-muted">{formatDate(todayISO())}</p>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <span className="rounded-full bg-[#f4ead6] px-2.5 py-1 text-[12px] text-foreground/80">
                {formatDate(todayISO())}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-primary">
                {morning ? <Sun size={12} /> : <Moon size={12} />}
                {morning ? "Morning" : "Evening"} shift
              </span>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold tracking-wide text-primary uppercase sm:px-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Offline desk
              </span>
              <UserMenu />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-6 pb-[max(12px,env(safe-area-inset-bottom))]">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

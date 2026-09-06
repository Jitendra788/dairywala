"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { currentShift, formatDate, todayISO } from "@/lib/dates";
import { useDairy } from "@/hooks/use-dairy";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { settings } = useDairy();
  const shift = currentShift() === "morning" ? "Morning" : "Evening";

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-card/80 px-4 backdrop-blur">
          <button
            type="button"
            className="rounded-md p-1.5 text-foreground lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <p className="hidden text-[13px] text-muted lg:block">
            {formatDate(todayISO())}
            <span className="mx-2 text-line">|</span>
            {shift} shift
          </p>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
              Offline
            </span>
            <span className="hidden text-[13px] sm:block">{settings.dairyName}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-dark text-[10px] font-bold text-white">
              TD
            </span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

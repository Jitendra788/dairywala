"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { HamariSidebar } from "@/components/hamari/sidebar";

export function HamariShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full bg-background">
      <HamariSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-3 pt-3 lg:hidden">
          <button
            type="button"
            className="rounded-md border border-line bg-card p-1.5"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        </div>
        <main className="flex-1 p-3 lg:p-4">{children}</main>
        <footer className="flex flex-wrap justify-between gap-2 border-t border-line bg-card px-4 py-2 text-[11px] text-muted">
          <span>App Version : 1.0.0</span>
          <span>© 2026 Created by Tony Dairy</span>
        </footer>
      </div>
    </div>
  );
}

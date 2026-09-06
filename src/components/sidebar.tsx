"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Droplets,
  LayoutDashboard,
  Settings2,
  Table2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { formatQty } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/collection", label: "Collection", icon: Droplets, match: (p: string) => p.startsWith("/collection") },
  { href: "/farmers", label: "Farmers", icon: Users, match: (p: string) => p.startsWith("/farmers") },
  { href: "/rate-charts", label: "Rate chart", icon: Table2, match: (p: string) => p.startsWith("/rate-charts") },
  { href: "/payments", label: "Payments", icon: Wallet, match: (p: string) => p.startsWith("/payments") },
  { href: "/reports", label: "Reports", icon: BarChart3, match: (p: string) => p.startsWith("/reports") },
  { href: "/settings", label: "Settings", icon: Settings2, match: (p: string) => p.startsWith("/settings") },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { settings, todayStats } = useDairy();
  const today = todayStats();

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/40 lg:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-[232px] shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-fg lg:static ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} transition-transform`}>
        <Link href="/" onClick={onClose} className="flex shrink-0 items-center gap-2.5 px-4 pt-4 pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-[13px] font-bold text-white shadow-[0_0_0_3px_rgba(27,122,74,0.25)]">
            TD
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[17px] leading-none text-white">
              {settings.dairyName}
            </span>
            <span className="mt-1 block truncate text-[10px] text-sidebar-fg/55">
              {settings.centerName}
            </span>
          </span>
        </Link>
        <button
          type="button"
          className="absolute top-3 right-3 rounded-md p-1 text-sidebar-fg/70 lg:hidden"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={16} />
        </button>

        <div className="mx-3 mb-3 shrink-0 rounded-xl bg-white/5 px-3 py-2.5">
          <p className="text-[10px] tracking-wide text-sidebar-fg/50 uppercase">Aaj ka doodh</p>
          <p className="font-display text-lg text-white">{formatQty(today.qty)}</p>
          <p className="text-[10px] text-sidebar-fg/50">{today.slips} slips</p>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-2.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                href={item.href}
                active={item.match(pathname)}
                onClick={onClose}
                icon={<Icon size={16} strokeWidth={1.75} />}
              >
                <span className="flex-1">{item.label}</span>
                {item.href === "/collection" && today.slips > 0 ? (
                  <span className="rounded-full bg-white/12 px-1.5 text-[10px]">{today.slips}</span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/8 px-4 py-3 text-[10px] leading-4 text-sidebar-fg/45">
          Offline desk
          <br />
          Browser mein save
        </div>
      </aside>
    </>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] ${
        active
          ? "bg-primary text-white shadow-sm"
          : "text-sidebar-fg/75 hover:bg-white/6 hover:text-white"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  Droplets,
  LayoutDashboard,
  Settings2,
  Table2,
  Users,
  UserRound,
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
  { href: "/payments", label: "Payments", icon: Wallet, match: (p: string) => p === "/payments" || p.startsWith("/payments/") },
  { href: "/reports", label: "Reports", icon: BarChart3, match: (p: string) => p.startsWith("/reports") },
  { href: "/settings", label: "Settings", icon: Settings2, match: (p: string) => p.startsWith("/settings") },
];

const customerLinks = [
  { href: "/customers", label: "All Customers" },
  { href: "/customers/new", label: "Add Customer" },
  { href: "/customers/delivery", label: "Daily Milk Delivery" },
  { href: "/customers/ledger", label: "Milk Ledger" },
  { href: "/customers/bills", label: "Monthly Bills" },
  { href: "/customers/payments", label: "Payments" },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { settings, todayStats } = useDairy();
  const today = todayStats();

  return (
    <>
      <div className={`fixed inset-0 z-30 bg-black/45 lg:hidden ${open ? "block" : "hidden"}`} onClick={onClose} />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-[min(236px,88vw)] shrink-0 flex-col overflow-hidden text-sidebar-fg lg:static lg:w-[236px] ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } transition-transform pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
        style={{
          background:
            "linear-gradient(180deg, #123526 0%, #0b1d14 42%, #0a1912 100%)",
        }}
      >
        <Link href="/" onClick={onClose} className="flex shrink-0 items-center gap-2.5 px-4 pt-4 pb-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_0_0_4px_rgba(24,122,72,0.28)]">
            <Droplets size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[18px] leading-none text-white">
              {settings.dairyName}
            </span>
            <span className="mt-1 block truncate text-[10px] text-sidebar-fg/50">
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

        <div className="mx-3 mb-3 shrink-0 rounded-2xl border border-white/8 bg-white/6 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] tracking-[0.14em] text-sidebar-fg/45 uppercase">Today</p>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
          <p className="mt-1 font-display text-[22px] leading-none text-white">{formatQty(today.qty)}</p>
          <p className="mt-1 text-[10px] text-sidebar-fg/45">{today.slips} slips · {today.farmers} farmers</p>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-2.5">
          {items.slice(0, 3).map((item) => {
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
                  <span className="rounded-full bg-white/15 px-1.5 text-[10px]">{today.slips}</span>
                ) : null}
              </NavLink>
            );
          })}

          <CustomersNav pathname={pathname} onClose={onClose} />

          {items.slice(3).map((item) => {
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
              </NavLink>
            );
          })}
        </nav>

        <div className="mx-3 mb-3 shrink-0 rounded-xl bg-black/20 px-3 py-2.5 text-[10px] leading-4 text-sidebar-fg/45">
          Offline desk
          <span className="mt-0.5 block text-sidebar-fg/30">Saved in this browser</span>
        </div>
      </aside>
    </>
  );
}

function CustomersNav({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const inCustomers = pathname.startsWith("/customers");
  const open = inCustomers;

  return (
    <div className="shrink-0">
      <Link
        href="/customers"
        onClick={onClose}
        className={`flex items-center gap-2.5 rounded-xl px-2.5 py-[7px] text-[13px] ${
          inCustomers
            ? "bg-primary text-white shadow-[0_6px_16px_rgba(24,122,72,0.35)]"
            : "text-sidebar-fg/70 hover:bg-white/6 hover:text-white"
        }`}
      >
        <UserRound size={16} strokeWidth={1.75} />
        <span className="flex-1">Customers</span>
        <ChevronDown size={13} className={open ? "rotate-180" : ""} />
      </Link>
      {open ? (
        <div className="mt-0.5 ml-3 border-l border-white/10 pl-2">
          {customerLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`block rounded-lg px-2 py-[4px] text-[11px] ${
                  active ? "bg-white/12 text-white" : "text-sidebar-fg/55 hover:bg-white/6 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
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
      className={`flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-[8px] text-[13px] ${
        active
          ? "bg-primary text-white shadow-[0_6px_16px_rgba(24,122,72,0.35)]"
          : "text-sidebar-fg/70 hover:bg-white/6 hover:text-white"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

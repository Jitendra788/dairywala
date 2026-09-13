"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  Droplets,
  Package,
  Settings,
  ShoppingBag,
  Users,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/hamari/icons";

type Item = {
  href?: string;
  label: string;
  icon: ReactNode;
  children?: { href: string; label: string }[];
};

const menu: Item[] = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { href: "/buy-milk", label: "Buy Milk", icon: <Droplets size={16} /> },
  { href: "/sell-milk", label: "Sell Milk", icon: <ShoppingBag size={16} /> },
  { href: "/seller", label: "Seller", icon: <Users size={16} /> },
  { href: "/buyer", label: "Buyer", icon: <UserRound size={16} /> },
  {
    label: "Manage Customer",
    icon: <Users size={16} />,
    children: [
      { href: "/seller", label: "Seller list" },
      { href: "/buyer", label: "Buyer list" },
    ],
  },
  {
    label: "Manage Cluster",
    icon: <MapPinned size={16} />,
    children: [{ href: "/cluster", label: "Clusters" }],
  },
  { href: "/charts", label: "Charts", icon: <BarChart3 size={16} /> },
  {
    label: "Manage Bill",
    icon: <Wallet size={16} />,
    children: [
      { href: "/bills", label: "Bills" },
      { href: "/bills", label: "Advances" },
    ],
  },
  { href: "/reports", label: "Reports", icon: <ClipboardList size={16} /> },
  {
    label: "Manage Ledger",
    icon: <BookOpen size={16} />,
    children: [{ href: "/ledger", label: "Farmer ledger" }],
  },
  {
    label: "Manage Product",
    icon: <Package size={16} />,
    children: [{ href: "/products", label: "Products" }],
  },
  { href: "/settings", label: "Settings", icon: <Settings size={16} /> },
];

export function HamariSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className={`fixed inset-0 z-30 bg-black/40 lg:hidden ${open ? "block" : "hidden"}`} onClick={onClose} />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-sidebar text-sidebar-fg transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-3 py-4">
          <LogoMark />
          <div>
            <p className="text-sm font-semibold text-white">DudhSetu</p>
            <p className="text-[10px] text-sidebar-fg/60">Milk collection</p>
          </div>
          <button type="button" className="ml-auto lg:hidden" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {menu.map((item) =>
            item.children ? (
              <Drop key={item.label} item={item} pathname={pathname} onClose={onClose} />
            ) : (
              <Link
                key={item.label}
                href={item.href ?? "/"}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] ${
                  pathname === item.href
                    ? "bg-orange text-white"
                    : "text-sidebar-fg/85 hover:bg-white/5"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </aside>
    </>
  );
}

function Drop({
  item,
  pathname,
  onClose,
}: {
  item: Item;
  pathname: string;
  onClose: () => void;
}) {
  const childActive = item.children?.some((c) => c.href === pathname);
  const [open, setOpen] = useState(Boolean(childActive));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-sidebar-fg/85 hover:bg-white/5"
      >
        {item.icon}
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown size={14} className={open ? "rotate-180" : ""} />
      </button>
      {open ? (
        <div className="mb-1 ml-6 mt-0.5 space-y-0.5">
          {item.children?.map((child) => (
            <Link
              key={child.label}
              href={child.href}
              onClick={onClose}
              className={`block rounded-md px-2 py-1.5 text-xs ${
                pathname === child.href ? "text-orange" : "text-sidebar-fg/70 hover:text-white"
              }`}
            >
              {child.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

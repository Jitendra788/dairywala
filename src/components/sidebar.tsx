"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  Droplets,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Table2,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { formatQty } from "@/lib/money";
import { logout } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useDairy } from "@/hooks/use-dairy";

type GroupKey = "milk" | "customers" | "finance" | "payments" | "rates" | "rateChart" | "reports" | "reportsMenu" | "management" | "settings";

type NavChild = { href: string; label: string; exact?: boolean };

function defaultsForPath(pathname: string): Record<GroupKey, boolean> {
  const customers = pathname.startsWith("/customers");
  const finance = pathname.startsWith("/payments");
  const rates = pathname.startsWith("/rate-charts");
  const reports = pathname.startsWith("/reports");
  const settings = pathname.startsWith("/settings") || pathname.startsWith("/plan");
  return {
    milk: true,
    customers,
    finance,
    payments: finance || pathname === "/customers/payments",
    rates,
    rateChart: rates,
    reports,
    reportsMenu: reports || pathname.startsWith("/customers/ledger") || pathname.startsWith("/customers/walk-in"),
    management: settings,
    settings,
  };
}

export function Sidebar({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
}: {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { settings, todayStats, bills } = useDairy();
  const { username } = useAuth();
  const today = todayStats();
  const [online, setOnline] = useState(true);
  const [hash, setHash] = useState("");
  const [groups, setGroups] = useState<Record<GroupKey, boolean>>(() => defaultsForPath(pathname));

  const unpaidBills = useMemo(() => bills.filter((bill) => bill.status === "open").length, [bills]);

  useEffect(() => {
    const syncOnline = () => setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const syncHash = () => setHash(window.location.hash);
    syncOnline();
    syncHash();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    window.addEventListener("hashchange", syncHash);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("hashchange", syncHash);
    };
  }, [pathname]);

  function toggle(key: GroupKey) {
    const accordion: GroupKey[] = ["customers", "payments", "rateChart", "reportsMenu", "settings"];
    if (collapsed) {
      onToggleCollapse();
      setGroups((prev) => {
        const next = { ...prev };
        accordion.forEach((item) => {
          next[item] = item === key;
        });
        return next;
      });
      return;
    }
    setGroups((prev) => {
      const opening = !prev[key];
      const next = { ...prev };
      accordion.forEach((item) => {
        next[item] = item === key ? opening : false;
      });
      return next;
    });
  }

  const query = searchParams.toString();

  const customerChildren: NavChild[] = [
    { href: "/customers", label: "All Customers", exact: true },
    { href: "/customers?type=regular", label: "Regular Customers" },
    { href: "/customers/walk-in", label: "Daily / Walk-in" },
    { href: "/customers/delivery", label: "Daily Milk Delivery" },
    { href: "/customers/ledger", label: "Milk Ledger" },
    { href: "/customers/payments", label: "Customer Payments" },
    { href: "/customers/bills", label: "Monthly Bills" },
  ];

  const paymentChildren: NavChild[] = [
    { href: "/payments", label: "Receive Payment", exact: true },
    { href: "/payments?tab=bills", label: "Farmer Payments" },
    { href: "/customers/payments", label: "Customer Payments" },
    { href: "/payments?status=open", label: "Pending Payments" },
    { href: "/payments?tab=history", label: "Payment History" },
  ];

  const rateChildren: NavChild[] = [
    { href: "/rate-charts", label: "Today's Rate", exact: true },
    { href: "/rate-charts?milk=cow", label: "Cow Rate" },
    { href: "/rate-charts?milk=buffalo", label: "Buffalo Rate" },
    { href: "/rate-charts?method=grid", label: "FAT/SNF Rate" },
    { href: "/rate-charts?view=history", label: "Rate History" },
  ];

  const reportChildren: NavChild[] = [
    { href: "/reports", label: "Daily Report", exact: true },
    { href: "/reports#collection", label: "Milk Collection" },
    { href: "/reports#statement", label: "Farmer Statement" },
    { href: "/customers/ledger", label: "Customer Statement" },
    { href: "/customers/walk-in", label: "Sales Report" },
  ];

  const settingChildren: NavChild[] = [
    { href: "/settings#profile", label: "Dairy Profile" },
    { href: "/settings#account", label: "Users & Staff" },
    { href: "/rate-charts", label: "Milk Settings" },
    { href: "/payments", label: "Payment Settings" },
    { href: "/settings#data", label: "Backup" },
  ];

  return (
    <>
      <div className={`fixed inset-0 z-30 bg-black/45 lg:hidden ${open ? "block" : "hidden"}`} onClick={onClose} />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh shrink-0 flex-col overflow-hidden text-sidebar-fg lg:static ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "w-[min(236px,88vw)] lg:w-[72px]" : "w-[min(260px,88vw)] lg:w-[260px]"} transition-[width,transform] duration-200 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}
        style={{
          background: "linear-gradient(180deg, #123526 0%, #0b1d14 42%, #0a1912 100%)",
        }}
      >
        <div className={`flex shrink-0 items-center gap-2 px-3 pt-3 ${collapsed ? "lg:justify-center lg:px-2" : "px-3"} pb-2`}>
          <Link href="/" onClick={onClose} className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_0_0_4px_rgba(24,122,72,0.28)]">
              <Droplets size={18} />
            </span>
            <span className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <span className="block truncate font-display text-[18px] leading-none text-white">{settings.dairyName}</span>
              <span className="mt-1 block truncate text-[10px] text-white/65">{settings.centerName}</span>
            </span>
          </Link>
          <button
            type="button"
            className="ml-auto rounded-md p-1 text-sidebar-fg/70 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <div className={`mx-2.5 mb-2 shrink-0 rounded-xl border border-white/10 bg-white/6 ${collapsed ? "lg:mx-2 lg:px-1.5 lg:py-2" : "px-2.5 py-2"}`}>
          <div className={`flex items-center justify-between ${collapsed ? "lg:justify-center" : ""}`}>
            <p className={`text-[10px] font-semibold tracking-[0.12em] text-white/70 uppercase ${collapsed ? "lg:hidden" : ""}`}>Today</p>
            <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-amber-400"}`} />
          </div>
          <p className={`mt-0.5 font-display leading-none text-white ${collapsed ? "lg:mt-0 lg:text-center lg:text-[13px]" : "text-[20px]"}`}>
            {formatQty(today.qty)}
          </p>
          <p className={`mt-0.5 text-[10px] text-white/55 ${collapsed ? "lg:hidden" : ""}`}>
            {today.slips} slips · {today.farmers} farmers
          </p>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-1">
          <SectionLabel collapsed={collapsed}>Main</SectionLabel>
          <NavLink
            href="/"
            active={pathname === "/"}
            collapsed={collapsed}
            label="Dashboard"
            onClick={onClose}
            icon={<LayoutDashboard size={16} strokeWidth={1.75} />}
          />

          <SectionLabel collapsed={collapsed}>Milk Operations</SectionLabel>
          <NavLink
            href="/collection"
            active={pathname.startsWith("/collection")}
            collapsed={collapsed}
            label="Collection"
            onClick={onClose}
            icon={<Droplets size={16} strokeWidth={1.75} />}
            badge={today.slips}
          />
          <NavLink
            href="/farmers"
            active={pathname.startsWith("/farmers")}
            collapsed={collapsed}
            label="Farmers"
            onClick={onClose}
            icon={<Users size={16} strokeWidth={1.75} />}
          />
          <Branch
            href="/customers"
            label="Customers"
            icon={<UserRound size={16} strokeWidth={1.75} />}
            active={pathname.startsWith("/customers")}
            open={groups.customers}
            collapsed={collapsed}
            onToggle={() => toggle("customers")}
            onNavigate={onClose}
            childrenItems={customerChildren}
            pathname={pathname}
            query={query}
            hash={hash}
          />

          <SectionLabel collapsed={collapsed}>Finance</SectionLabel>
          <Branch
            href="/payments"
            label="Payments"
            icon={<Wallet size={16} strokeWidth={1.75} />}
            active={pathname === "/payments" || pathname.startsWith("/payments/")}
            open={groups.payments}
            collapsed={collapsed}
            onToggle={() => toggle("payments")}
            onNavigate={onClose}
            childrenItems={paymentChildren}
            pathname={pathname}
            query={query}
            hash={hash}
            badge={unpaidBills}
          />

          <SectionLabel collapsed={collapsed}>Rate & Calculation</SectionLabel>
          <Branch
            href="/rate-charts"
            label="Rate Chart"
            icon={<Table2 size={16} strokeWidth={1.75} />}
            active={pathname.startsWith("/rate-charts")}
            open={groups.rateChart}
            collapsed={collapsed}
            onToggle={() => toggle("rateChart")}
            onNavigate={onClose}
            childrenItems={rateChildren}
            pathname={pathname}
            query={query}
            hash={hash}
          />

          <SectionLabel collapsed={collapsed}>Reports</SectionLabel>
          <Branch
            href="/reports"
            label="Reports"
            icon={<BarChart3 size={16} strokeWidth={1.75} />}
            active={pathname.startsWith("/reports")}
            open={groups.reportsMenu}
            collapsed={collapsed}
            onToggle={() => toggle("reportsMenu")}
            onNavigate={onClose}
            childrenItems={reportChildren}
            pathname={pathname}
            query={query}
            hash={hash}
          />

          <SectionLabel collapsed={collapsed}>Management</SectionLabel>
          <Branch
            href="/settings"
            label="Settings"
            icon={<Settings2 size={16} strokeWidth={1.75} />}
            active={pathname.startsWith("/settings")}
            open={groups.settings}
            collapsed={collapsed}
            onToggle={() => toggle("settings")}
            onNavigate={onClose}
            childrenItems={settingChildren}
            pathname={pathname}
            query={query}
            hash={hash}
          />
        </nav>

        <div className={`mx-2.5 mb-2 shrink-0 space-y-1.5 ${collapsed ? "lg:mx-2" : ""}`}>
          <div className={`flex items-center gap-2 rounded-xl bg-black/25 ${collapsed ? "lg:justify-center lg:px-1.5 lg:py-2" : "px-2.5 py-2"}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {(username || "AD").slice(0, 2).toUpperCase()}
            </span>
            <span className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <span className="block truncate text-[12px] font-semibold text-white">{username || "Admin"}</span>
              <span className="flex items-center gap-1 text-[10px] text-white/60">
                <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-amber-400"}`} />
                {online ? "Online" : "Offline"} · Admin
              </span>
            </span>
            <Link
              href="/settings"
              onClick={onClose}
              title="Settings"
              className={`rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white ${collapsed ? "lg:hidden" : ""}`}
            >
              <Settings2 size={13} />
            </Link>
            <button
              type="button"
              title="Logout"
              className={`rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white ${collapsed ? "lg:hidden" : ""}`}
              onClick={() => {
                logout();
                onClose();
                router.replace("/login");
              }}
            >
              <LogOut size={13} />
            </button>
          </div>

          <button
            type="button"
            className="hidden w-full items-center justify-center gap-2 rounded-lg py-1 text-[11px] text-white/55 hover:bg-white/6 hover:text-white lg:flex"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            {collapsed ? null : <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ children, collapsed }: { children: ReactNode; collapsed: boolean }) {
  return (
    <p className={`mt-1.5 mb-0.5 px-2.5 text-[11px] font-semibold tracking-[0.08em] text-white/75 uppercase first:mt-0 ${collapsed ? "lg:hidden" : ""}`}>
      {children}
    </p>
  );
}

function NavLink({
  href,
  active,
  icon,
  label,
  badge,
  collapsed,
  onClick,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  badge?: number;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      className={`group relative flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-[6px] text-[13px] ${
        collapsed ? "lg:justify-center lg:px-0" : ""
      } ${
        active
          ? "bg-primary text-white shadow-[0_6px_16px_rgba(24,122,72,0.35)]"
          : "text-white/85 hover:bg-white/8 hover:text-white"
      }`}
    >
      {icon}
      <span className={`flex-1 ${collapsed ? "lg:hidden" : ""}`}>{label}</span>
      {badge && badge > 0 ? (
        <span className={`rounded-full bg-white/15 px-1.5 text-[10px] ${collapsed ? "lg:absolute lg:top-1 lg:right-1 lg:px-1" : ""}`}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function childActive(pathname: string, href: string, query: string, hash: string, exact?: boolean) {
  const url = new URL(href, "http://local.invalid");
  const clean = url.pathname;
  const want = url.searchParams;
  const have = new URLSearchParams(query);
  if (url.hash) return pathname === clean && hash === url.hash;
  if (want.size > 0) {
    return pathname === clean && [...want.entries()].every(([key, value]) => have.get(key) === value);
  }
  if (exact) return pathname === clean && have.size === 0;
  if (clean === "/customers") return pathname === "/customers" && have.size === 0;
  return pathname === clean || (clean !== "/" && pathname.startsWith(`${clean}/`));
}

function Branch({
  href,
  label,
  icon,
  active,
  open,
  collapsed,
  badge,
  childrenItems,
  pathname,
  query,
  hash,
  onToggle,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  open: boolean;
  collapsed: boolean;
  badge?: number;
  childrenItems: NavChild[];
  pathname: string;
  query: string;
  hash: string;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="shrink-0">
      <div
        className={`flex items-center rounded-xl ${
          active
            ? open
              ? "bg-white/8 text-white"
              : "bg-primary text-white shadow-[0_6px_16px_rgba(24,122,72,0.35)]"
            : ""
        }`}
      >
        <Link
          href={href}
          onClick={onNavigate}
          title={label}
          className={`flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-[6px] text-[13px] ${
            collapsed ? "lg:justify-center lg:px-0" : ""
          } ${active ? "text-white" : "text-white/85 hover:text-white"}`}
        >
          {icon}
          <span className={`flex-1 ${collapsed ? "lg:hidden" : ""}`}>{label}</span>
          {badge && badge > 0 ? (
            <span className={`rounded-full bg-white/15 px-1.5 text-[10px] ${collapsed ? "lg:hidden" : ""}`}>{badge}</span>
          ) : null}
        </Link>
        <button
          type="button"
          className={`px-2 py-[6px] text-white/60 hover:text-white ${collapsed ? "lg:hidden" : ""}`}
          onClick={onToggle}
          aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
        >
          <ChevronDown size={13} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${
          open && !collapsed ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        } ${collapsed ? "lg:hidden" : ""}`}
      >
        <div className="overflow-hidden">
          <div className="mt-0.5 ml-3 border-l border-white/10 pl-2">
            {childrenItems.map((link) => {
              const current = childActive(pathname, link.href, query, hash, link.exact);
              return (
                <Link
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  onClick={onNavigate}
                  className={`block rounded-lg px-2 py-[3px] text-[12px] ${
                    current ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

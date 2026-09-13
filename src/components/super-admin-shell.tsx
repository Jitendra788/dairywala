"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Bell,
  ChevronDown,
  CreditCard,
  Database,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  ScrollText,
  Settings2,
  Shield,
  Store,
  Users,
  X,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { ToastProvider } from "@/components/toast";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/hooks/use-i18n";
import type { DictKey } from "@/lib/i18n/dict";

type Child = { href: string; labelKey: DictKey };

const nav: Array<{ href?: string; id: string; labelKey: DictKey; icon: ReactNode; children?: Child[] }> = [
  { href: "/admin", id: "dashboard", labelKey: "adminDashboard", icon: <LayoutDashboard size={16} /> },
  {
    id: "dairies",
    labelKey: "adminDairies",
    icon: <Store size={16} />,
    children: [
      { href: "/admin/dairies", labelKey: "allDairies" },
      { href: "/admin/dairies?status=pending", labelKey: "pendingApproval" },
      { href: "/admin/dairies?status=active", labelKey: "activeDairies" },
      { href: "/admin/dairies?status=suspended", labelKey: "suspended" },
      { href: "/admin/dairies?status=cancelled", labelKey: "cancelled" },
    ],
  },
  { href: "/admin/users", id: "users", labelKey: "usersRoles", icon: <Users size={16} /> },
  {
    id: "subscriptions",
    labelKey: "subscriptions",
    icon: <CreditCard size={16} />,
    children: [
      { href: "/admin/subscriptions?tab=plans", labelKey: "plans" },
      { href: "/admin/subscriptions?tab=active", labelKey: "activeSubs" },
      { href: "/admin/subscriptions?tab=expiring", labelKey: "expiringSoon" },
      { href: "/admin/subscriptions?tab=expired", labelKey: "expired" },
      { href: "/admin/subscriptions?tab=payments", labelKey: "payments" },
    ],
  },
  { href: "/admin/analytics", id: "analytics", labelKey: "analytics", icon: <Activity size={16} /> },
  { href: "/admin/support", id: "support", labelKey: "support", icon: <LifeBuoy size={16} /> },
  { href: "/admin/notifications", id: "notifications", labelKey: "notifications", icon: <Bell size={16} /> },
  { href: "/admin/audit", id: "audit", labelKey: "auditLogs", icon: <ScrollText size={16} /> },
  { href: "/admin/backup", id: "backup", labelKey: "dataBackup", icon: <Database size={16} /> },
  { href: "/admin/health", id: "health", labelKey: "systemHealth", icon: <HeartPulse size={16} /> },
  { href: "/admin/settings", id: "settings", labelKey: "platformSettings", icon: <Settings2 size={16} /> },
];

function childActive(pathname: string, query: string, href: string) {
  const url = new URL(href, "http://local.invalid");
  if (pathname !== url.pathname) return false;
  if (url.searchParams.size === 0) return !query;
  return [...url.searchParams.entries()].every(([key, value]) => new URLSearchParams(query).get(key) === value);
}

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Record<string, boolean>>({ dairies: true, subscriptions: true });
  const { t } = useI18n();

  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        <div className={`fixed inset-0 z-30 bg-black/45 lg:hidden ${open ? "block" : "hidden"}`} onClick={() => setOpen(false)} />
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[min(270px,88vw)] flex-col text-sidebar-fg transition-transform lg:static lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ background: "linear-gradient(180deg, #123526 0%, #0b1d14 100%)" }}
        >
          <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
            <img src="/dairy-logo.png" alt="" className="h-9 w-9 rounded-xl object-contain" />
            <div className="min-w-0">
              <p className="font-display text-[17px] leading-none text-white">DudhSetu</p>
              <p className="mt-1 text-[10px] text-white/60">{t("superAdmin")}</p>
            </div>
            <button type="button" className="ml-auto rounded-md p-1 lg:hidden" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
            {nav.map((item) => {
              if (item.children) {
                const branchOpen = groups[item.id];
                const active = item.children.some((child) => childActive(pathname, query, child.href));
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-[7px] text-left text-[13px] ${
                        active ? "bg-white/10 text-white" : "text-white/85 hover:bg-white/8"
                      }`}
                      onClick={() => setGroups((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                    >
                      {item.icon}
                      <span className="flex-1">{t(item.labelKey)}</span>
                      <ChevronDown size={13} className={branchOpen ? "rotate-180" : ""} />
                    </button>
                    {branchOpen ? (
                      <div className="ml-3 border-l border-white/10 pl-2">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className={`block rounded-lg px-2 py-[4px] text-[12px] ${
                              childActive(pathname, query, child.href) ? "bg-primary text-white" : "text-white/70 hover:text-white"
                            }`}
                          >
                            {t(child.labelKey)}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-[7px] text-[13px] ${
                    active ? "bg-primary text-white" : "text-white/85 hover:bg-white/8"
                  }`}
                >
                  {item.icon}
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-line bg-card px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-4">
            <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg lg:hidden" onClick={() => setOpen(true)} aria-label={t("openMenu")}>
              <Menu size={20} />
            </button>
            <Shield size={16} className="hidden shrink-0 text-primary sm:block" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold sm:text-[14px]">{t("platformControl")}</p>
              <p className="hidden truncate text-[11px] text-muted sm:block">{t("platformAdminHint")}</p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
              <LanguageSwitch />
              <Link href="/admin/notifications" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-[#f7f1e6] sm:h-auto sm:w-auto sm:p-2" aria-label={t("notifications")}>
                <Bell size={16} />
              </Link>
              <button
                type="button"
                className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line px-2.5 text-[13px] hover:bg-[#f7f1e6] sm:h-auto sm:px-3 sm:py-1.5"
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
              >
                <LogOut size={14} /> <span className="hidden sm:inline">{t("logout")}</span>
              </button>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-[max(16px,env(safe-area-inset-bottom))]">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

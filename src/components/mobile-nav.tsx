"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplets, LayoutDashboard, Menu, Users, Wallet } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";

export function MobileNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const items = [
    { href: "/", label: t("navHome"), icon: LayoutDashboard, active: pathname === "/" },
    { href: "/collection", label: t("navCollection"), icon: Droplets, active: pathname.startsWith("/collection") },
    { href: "/farmers", label: t("navFarmers"), icon: Users, active: pathname.startsWith("/farmers") },
    {
      href: "/payments",
      label: t("navPayments"),
      icon: Wallet,
      active: pathname.startsWith("/payments") || pathname.startsWith("/customers/payments"),
    },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-1 pt-1 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold ${
                item.active ? "text-primary" : "text-muted"
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.active ? "bg-emerald-50" : ""}`}>
                <Icon size={18} strokeWidth={item.active ? 2.4 : 2} />
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold text-muted"
          onClick={onMore}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl">
            <Menu size={18} />
          </span>
          {t("navMore")}
        </button>
      </div>
    </nav>
  );
}

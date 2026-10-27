"use client";

import Link from "next/link";
import { useI18n } from "@/hooks/use-i18n";
import { btnGhost, btnPrimary } from "@/components/ui";

export type PayTab = "farmer" | "pending" | "customer" | "advance" | "history";

export function PayTabs({ active }: { active: PayTab }) {
  const { t } = useI18n();
  const items: { id: PayTab; href: string; label: string }[] = [
    { id: "farmer", href: "/payments", label: t("farmerPayments") },
    { id: "pending", href: "/payments?status=open", label: t("pendingPayments") },
    { id: "customer", href: "/customers/payments", label: t("customerPayments") },
    { id: "advance", href: "/payments?tab=advances", label: t("advances") },
    { id: "history", href: "/payments?tab=history", label: t("farmerHistory") },
  ];
  return (
    <div className="chip-row">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className={active === item.id ? btnPrimary : btnGhost}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}

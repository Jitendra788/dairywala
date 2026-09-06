import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Beaker,
  Container,
  Factory,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  Map,
  Package,
  Receipt,
  Settings2,
  ShoppingBag,
  Table2,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Droplets,
} from "lucide-react";

export const moduleIcons: Record<string, LucideIcon> = {
  collection: Droplets,
  farmers: Users,
  "rate-charts": Table2,
  payments: Wallet,
  network: Map,
  logistics: Truck,
  intake: Warehouse,
  tanks: Container,
  production: Factory,
  inventory: Package,
  quality: FlaskConical,
  sales: ShoppingBag,
  finance: Landmark,
  livestock: Beaker,
  reports: BarChart3,
  settings: Settings2,
  dashboard: LayoutDashboard,
  plan: Receipt,
};

export function ModuleIcon({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const Icon = moduleIcons[slug] ?? Droplets;
  return <Icon className={className} strokeWidth={1.75} />;
}

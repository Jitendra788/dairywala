"use client";

import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import { AdminStatus, BarChart, DonutChart, EmptyState, KpiCard, LineChart, LoadingState, Panel, usePlatform } from "@/components/admin/admin-kit";
import { useI18n } from "@/hooks/use-i18n";

type Dash = {
  kpis: {
    dairies: number;
    active: number;
    pending: number;
    suspended: number;
    totalUsers: number;
    totalFarmers: number;
    totalCustomers: number;
    todayQty: number;
    todayRevenue: number;
    pendingPayments: number;
  };
  charts: {
    registrations: { label: string; value: number }[];
    milk: { label: string; value: number }[];
    revenue: { label: string; value: number }[];
    status: { label: string; value: number }[];
    topDairies: { label: string; value: number }[];
  };
  pending: { id: string; name: string; email: string; dairyName: string; createdAt: string }[];
  expiring: { id: string; dairyName: string; status: string; expiresAt: string | null }[];
  activity: { id: string; actor: string; action: string; dairyName: string; createdAt: string; module: string }[];
};

export function DashboardAdmin() {
  const { t } = useI18n();
  const { data, error, loading } = usePlatform<Dash>("dashboard");
  if (loading) return <LoadingState />;
  if (error || !data) return <EmptyState text={error || t("dashboardClosed")} />;
  const k = data.kpis;
  const cards = [
    { href: "/admin/dairies", label: t("totalDairies"), value: String(k.dairies) },
    { href: "/admin/dairies?status=active", label: t("activeDairies"), value: String(k.active) },
    { href: "/admin/dairies?status=pending", label: t("pendingApproval"), value: String(k.pending) },
    { href: "/admin/dairies?status=suspended", label: t("suspended"), value: String(k.suspended) },
    { href: "/admin/users", label: t("totalUsers"), value: String(k.totalUsers) },
    { href: "/admin/analytics", label: t("totalFarmers"), value: String(k.totalFarmers) },
    { href: "/admin/analytics", label: t("totalCustomersLabel"), value: String(k.totalCustomers) },
    { href: "/admin/analytics", label: t("todaysMilk"), value: formatQty(k.todayQty) },
    { href: "/admin/subscriptions?tab=payments", label: t("todaysRevenue"), value: formatInr(k.todayRevenue) },
    { href: "/admin/analytics", label: t("pendingPayments"), value: formatInr(k.pendingPayments) },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">{t("commandCenter")}</p>
        <h1 className="font-display text-[26px] leading-none">{t("platformDashboard")}</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={t("dairyRegistration")}>
          <BarChart data={data.charts.registrations} />
        </Panel>
        <Panel title={t("milkTrend")}>
          <LineChart data={data.charts.milk} />
        </Panel>
        <Panel title={t("revenueTrend")}>
          <LineChart data={data.charts.revenue} />
        </Panel>
        <Panel title={t("activeVsInactive")}>
          <DonutChart data={data.charts.status} />
        </Panel>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={t("topDairiesMilk")} action={<Link href="/admin/dairies" className="text-[12px] text-primary">{t("all")}</Link>}>
          {data.charts.topDairies.length === 0 ? (
            <EmptyState text="Collection abhi nahi aayi" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.charts.topDairies.map((row) => (
                <li key={row.label} className="flex justify-between px-4 py-2">
                  <span>{row.label}</span>
                  <b>{formatQty(row.value)}</b>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("recentActivity")} action={<Link href="/admin/audit" className="text-[12px] text-primary">{t("auditLogs")}</Link>}>
          {data.activity.length === 0 ? (
            <EmptyState text="Abhi koi admin action nahi" />
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {data.activity.map((row) => (
                <li key={row.id} className="px-4 py-2">
                  <p>
                    <b>{row.actor}</b> · {row.action} · {row.module}
                  </p>
                  <p className="text-[11px] text-muted">
                    {row.dairyName || "platform"} · {formatDate(row.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("pendingApprovals")} action={<Link href="/admin/dairies?status=pending" className="text-[12px] text-primary">{t("view")}</Link>}>
          {data.pending.length === 0 ? (
            <EmptyState text="Koi pending dairy nahi" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.pending.map((row) => (
                <li key={row.id} className="px-4 py-2">
                  <p className="font-medium">{row.dairyName || row.name}</p>
                  <p className="text-[11px] text-muted">{row.email}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("expiryAlerts")} action={<Link href="/admin/subscriptions?tab=expiring" className="text-[12px] text-primary">{t("plans")}</Link>}>
          {data.expiring.length === 0 ? (
            <EmptyState text="Koi expiry alert nahi" />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.expiring.map((row) => (
                <li key={row.id} className="flex items-center justify-between px-4 py-2">
                  <span>{row.dairyName}</span>
                  <AdminStatus status={row.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

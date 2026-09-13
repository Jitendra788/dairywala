"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Clock3, Droplets, FileSpreadsheet, TrendingUp, Users, Wallet } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { formatInr, formatQty, round2 } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { customerApi } from "@/lib/customers/client";
import type { CustomerDashboardStats } from "@/lib/customers/types";
import { addMonths, endOfMonth, formatDate, startOfMonth, todayISO } from "@/lib/dates";
import { farmerCode, farmerName } from "@/lib/farmer-label";
import { slipRef } from "@/lib/ref";
import { DairyLogo } from "@/components/dairy-brand";
import { btnInverse, Card, Initials, MilkBadge } from "@/components/ui";
import { ProfitLossCard, TodayMissionCard } from "@/components/views/finance-dashboard";
import type { FinanceGrain, FinanceReport } from "@/lib/finance/types";

export function DashboardView() {
  const dairy = useDairy();
  const { t } = useI18n();
  const today = dairy.todayStats();
  const recent = dairy.entries.slice(0, 7);
  const totalShift = today.morning + today.evening || 1;
  const [customerStats, setCustomerStats] = useState<CustomerDashboardStats | null>(null);
  const [monthReport, setMonthReport] = useState<FinanceReport | null>(null);
  const [pnlReport, setPnlReport] = useState<FinanceReport | null>(null);
  const [grain, setGrain] = useState<FinanceGrain>("month");
  const openBills = dairy.bills.filter((bill) => bill.status === "open");
  const farmerPending = round2(openBills.reduce((sum, bill) => sum + bill.net, 0));
  const farmerDebit = dairy.payableTotal();
  const customerCredit = customerStats?.pending.amount ?? 0;
  const customerPendingCount = customerStats?.pending.count ?? 0;

  useEffect(() => {
    customerApi<CustomerDashboardStats>(`/api/customers/stats?date=${todayISO()}`)
      .then(setCustomerStats)
      .catch(() => setCustomerStats(null));
  }, []);

  useEffect(() => {
    customerApi<FinanceReport>(`/api/finance?from=${startOfMonth()}&to=${endOfMonth()}`)
      .then(setMonthReport)
      .catch(() => setMonthReport(null));
    customerApi<FinanceReport>(`/api/finance?from=${addMonths(startOfMonth(), -11)}&to=${endOfMonth()}`)
      .then(setPnlReport)
      .catch(() => setPnlReport(null));
  }, []);

  return (
    <div className="mx-auto flex min-h-0 max-w-7xl flex-col gap-4">
      <section className="relative overflow-hidden rounded-[28px] bg-primary px-3.5 py-3.5 text-white shadow-[0_16px_40px_rgba(24,122,72,0.28)] sm:px-5 sm:py-5">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-16 -bottom-12 h-32 w-32 rounded-full bg-gold/20" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <DairyLogo
              settings={dairy.settings}
              size={48}
              className="rounded-2xl bg-white object-contain p-1 sm:h-14 sm:w-14"
            />
            <div className="min-w-0">
              <p className="text-[10px] tracking-[0.16em] text-white/70 uppercase sm:text-[11px] sm:tracking-[0.18em]">{dairy.settings.centerName || "Collection"}</p>
              <h1 className="mt-0.5 font-display text-[24px] leading-tight break-words sm:mt-1 sm:text-[34px] sm:leading-none">{dairy.settings.dairyName}</h1>
              <p className="mt-1 text-[13px] text-white/75 sm:mt-2 sm:text-sm">Aaj ka collection live desk par.</p>
            </div>
          </div>
          <div className="min-w-0 sm:text-right">
            <p className="text-[11px] text-white/65">Today</p>
            <p className="font-display text-[30px] leading-none sm:text-4xl">{formatQty(today.qty)}</p>
            <Link href="/collection" className={`${btnInverse} relative z-10 mt-2.5 min-h-11 w-full sm:mt-3 sm:w-auto`}>
              Start collection
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-1.5 text-sm sm:mt-5 sm:grid-cols-4 sm:gap-3">
          <HeroMini label="Value" value={formatInr(today.amount)} />
          <HeroMini label={t("dashPendingPay")} value={formatInr(farmerPending)} />
          <HeroMini label={t("dashCredit")} value={formatInr(customerCredit)} />
          <HeroMini label={t("dashDebit")} value={formatInr(farmerDebit)} />
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">{t("dashMoney")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <MoneyCard
            href="/payments?status=open"
            icon={<Clock3 size={16} />}
            label={t("dashPendingPay")}
            value={formatInr(farmerPending)}
            hint={t("dashPendingHint", { n: openBills.length })}
            tone="pending"
          />
          <MoneyCard
            href="/customers/payments"
            icon={<ArrowDownLeft size={16} />}
            label={t("dashCredit")}
            value={formatInr(customerCredit)}
            hint={`${t("dashToReceive")} · ${t("dashCreditHint", { n: customerPendingCount })}`}
            tone="credit"
          />
          <MoneyCard
            href="/payments?tab=bills"
            icon={<ArrowUpRight size={16} />}
            label={t("dashDebit")}
            value={formatInr(farmerDebit)}
            hint={t("dashToPay")}
            tone="debit"
          />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat icon={<Droplets size={16} />} label="Slips" value={String(today.slips)} hint={`${today.farmers} farmers`} />
        <Stat icon={<TrendingUp size={16} />} label="Morning" value={formatQty(today.morning)} hint={`${Math.round((today.morning / totalShift) * 100)}% of day`} />
        <Stat icon={<Users size={16} />} label="Evening" value={formatQty(today.evening)} hint={`${Math.round((today.evening / totalShift) * 100)}% of day`} />
      </div>

      {monthReport ? (
        <TodayMissionCard report={monthReport} />
      ) : null}

      {pnlReport ? (
        <ProfitLossCard report={pnlReport} grain={grain} onGrain={setGrain} />
      ) : null}

      {customerStats ? (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">Customer milk</p>
              <h2 className="font-display text-lg">Today from the database</h2>
            </div>
            <Link href="/customers/walk-in" className="text-xs font-semibold text-primary">
              Walk-in desk →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <MiniStat label="Milk sales" value={formatInr(customerStats.today.sales)} hint={`${formatQty(customerStats.today.qty)} sold`} />
            <MiniStat label="Walk-in" value={formatInr(customerStats.today.walkInSales)} hint={`${formatQty(customerStats.today.walkInQty)}`} />
            <MiniStat label="Regular" value={formatInr(customerStats.today.regularSales)} hint={`${formatQty(customerStats.today.regularQty)}`} />
            <MiniStat label="Pending" value={formatInr(customerStats.pending.amount)} hint={`${customerStats.pending.count} customers`} />
            <MiniStat label="Customers" value={String(customerStats.customers.total)} hint={`${customerStats.customers.walkin} walk-in · ${customerStats.customers.regular} regular`} />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { href: "/collection", title: "Collect", text: "Code, qty, FAT/SNF, slip", icon: Droplets },
          { href: "/payments", title: "Pay & collect", text: "Farmer, customer, advance", icon: Wallet },
          { href: "/reports", title: "Reports", text: "Milk and farmer statement", icon: FileSpreadsheet },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 shadow-[0_8px_24px_rgba(22,48,36,0.04)] hover:border-primary/30 hover:shadow-[0_10px_28px_rgba(24,122,72,0.08)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-primary">
              <item.icon size={17} />
            </span>
            <span>
              <span className="block font-display text-lg leading-none">{item.title}</span>
              <span className="text-xs text-muted">{item.text}</span>
            </span>
          </Link>
        ))}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-lg">Recent slips</h2>
          <Link href="/collection" className="text-xs font-semibold text-primary">
            Open desk →
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="divide-y divide-line/70 md:hidden">
            {recent.map((e) => {
              const f = dairy.farmerById(e.farmerId);
              return (
                <Link key={e.id} href={`/collection/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf6ee]">
                  <Initials name={farmerName(f)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{farmerName(f)}</span>
                    <span className="text-[11px] text-muted capitalize">{slipRef(e.id)} · {formatDate(e.date)} · {e.shift} · {e.qty} L</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <MilkBadge type={e.milkType} />
                    <span className="mt-1 block text-[13px] font-semibold">{formatInr(e.amount)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          <table className="hidden w-full text-left text-[13px] md:table">
            <thead className="table-head sticky top-0 text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Reference</th>
                <th className="py-2.5 font-medium">Farmer</th>
                <th className="py-2.5 font-medium">When</th>
                <th className="py-2.5 font-medium">Milk</th>
                <th className="py-2.5 font-medium">L</th>
                <th className="py-2.5 font-medium">FAT/SNF</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => {
                const f = dairy.farmerById(e.farmerId);
                return (
                  <tr key={e.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/collection/${e.id}`} className="hover:text-primary">
                        {slipRef(e.id)}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <Link href={`/collection/${e.id}`} className="flex items-center gap-2 hover:text-primary">
                        <Initials name={farmerName(f)} />
                        <span>
                          <span className="block font-medium">{farmerName(f)}</span>
                          {farmerCode(f) ? <span className="text-[11px] text-muted">{farmerCode(f)}</span> : null}
                        </span>
                      </Link>
                    </td>
                    <td className="capitalize text-muted">
                      {formatDate(e.date)} · {e.shift}
                    </td>
                    <td>
                      <MilkBadge type={e.milkType} />
                    </td>
                    <td>{e.qty}</td>
                    <td>
                      {e.fat} / {e.snf}
                    </td>
                    <td className="px-4 font-semibold">{formatInr(e.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f1e6] px-3 py-2.5">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="font-display text-[20px] leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-muted">{hint}</p>
    </div>
  );
}

function MoneyCard({
  href,
  icon,
  label,
  value,
  hint,
  tone,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "pending" | "credit" | "debit";
}) {
  const skin =
    tone === "credit"
      ? "border-emerald-200 bg-emerald-50/80 text-primary"
      : tone === "debit"
        ? "border-red-200 bg-red-50 text-danger"
        : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-3.5 shadow-[0_8px_24px_rgba(22,48,36,0.04)] transition-transform duration-75 active:scale-[0.99] ${skin}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.12em] uppercase opacity-80">{label}</p>
        {icon}
      </div>
      <p className="mt-1.5 font-display text-[26px] leading-none text-foreground">{value}</p>
      <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
    </Link>
  );
}

function HeroMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-2 py-2 sm:px-3">
      <p className="text-[10px] text-white/65">{label}</p>
      <p className="truncate text-[12px] font-semibold sm:text-sm">{value}</p>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-1.5 font-display text-[26px] leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
    </Card>
  );
}

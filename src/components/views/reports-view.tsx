"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, endOfMonth, formatDateRange, startOfMonth, todayISO } from "@/lib/dates";
import { formatInr, formatQty, round2 } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { farmerLabel } from "@/lib/farmer-label";
import { customerApi } from "@/lib/customers/client";
import { Card, Field, inputClass, PageHeader } from "@/components/ui";
import { EarningReportCard, ProfitLossCard } from "@/components/views/finance-dashboard";
import type { FinanceGrain, FinanceReport } from "@/lib/finance/types";

export function ReportsView() {
  const dairy = useDairy();
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [grain, setGrain] = useState<FinanceGrain>("month");
  const [monthReport, setMonthReport] = useState<FinanceReport | null>(null);
  const [pnlReport, setPnlReport] = useState<FinanceReport | null>(null);

  const rows = useMemo(
    () => dairy.entries.filter((e) => e.date >= fromDate && e.date <= toDate),
    [dairy.entries, fromDate, toDate],
  );

  const qty = rows.reduce((s, e) => s + e.qty, 0);
  const amount = rows.reduce((s, e) => s + e.amount, 0);
  const avgFat = qty ? rows.reduce((s, e) => s + e.fat * e.qty, 0) / qty : 0;
  const avgSnf = qty ? rows.reduce((s, e) => s + e.snf * e.qty, 0) / qty : 0;

  useEffect(() => {
    const extra = includeDeleted ? "&includeDeleted=1" : "";
    customerApi<FinanceReport>(`/api/finance?from=${startOfMonth()}&to=${endOfMonth()}${extra}`)
      .then(setMonthReport)
      .catch(() => setMonthReport(null));
    customerApi<FinanceReport>(`/api/finance?from=${addMonths(startOfMonth(), -11)}&to=${endOfMonth()}${extra}`)
      .then(setPnlReport)
      .catch(() => setPnlReport(null));
  }, [includeDeleted]);

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [monthReport, pnlReport]);

  const byFarmer = new Map<string, { qty: number; amount: number }>();
  for (const e of rows) {
    const cur = byFarmer.get(e.farmerId) ?? { qty: 0, amount: 0 };
    cur.qty += e.qty;
    cur.amount += e.amount;
    byFarmer.set(e.farmerId, cur);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="रिपोर्ट"
        title="Milk reports"
        hint={`Date range se daily milk, quality, earning aur farmer-wise statement. Showing ${formatDateRange(fromDate, toDate)}.`}
      />

      {monthReport ? (
        <EarningReportCard
          report={monthReport}
          includeDeleted={includeDeleted}
          onIncludeDeleted={setIncludeDeleted}
          periodLabel="This month"
        />
      ) : null}
      {pnlReport ? <ProfitLossCard report={pnlReport} grain={grain} onGrain={setGrain} /> : null}

      <Card className="grid gap-3 p-5 md:grid-cols-2">
        <Field label="From">
          <input type="date" className={inputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" className={inputClass} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Field>
      </Card>

      <div id="collection" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Mini label="Milk" value={formatQty(round2(qty))} />
        <Mini label="Amount" value={formatInr(amount)} />
        <Mini label="Avg FAT" value={round2(avgFat).toFixed(2)} />
        <Mini label="Avg SNF" value={round2(avgSnf).toFixed(2)} />
      </div>

      <Card id="statement" className="p-5">
        <h2 className="font-display text-xl">Farmer statement</h2>
        <div className="table-scroll mt-3">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="pb-2 font-medium">Farmer</th>
              <th className="pb-2 font-medium">Qty</th>
              <th className="pb-2 font-medium">Amount</th>
              <th className="pb-2 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {[...byFarmer.entries()].map(([farmerId, tot]) => {
              const f = dairy.farmerById(farmerId);
              return (
                <tr key={farmerId} className="border-t border-line">
                  <td className="py-2.5">
                    {farmerLabel(f)}
                  </td>
                  <td>{formatQty(round2(tot.qty))}</td>
                  <td>{formatInr(tot.amount)}</td>
                  <td>{formatInr(dairy.farmerBalance(farmerId))}</td>
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { customerApi } from "@/lib/customers/client";
import type { BillRow } from "@/lib/customers/types";
import { todayISO } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import { useToast } from "@/components/toast";
import { Card, Field, inputClass, PageHeader } from "@/components/ui";
import { EmptyState, LoadingRows } from "@/components/customers/shared";

export function MonthlyBillsView() {
  const toast = useToast();
  const today = todayISO();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await customerApi<{ bills: BillRow[] }>(`/api/customers/bills?year=${year}&month=${month}`);
      setBills(data.bills);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not load bills", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [year, month]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        kicker="मासिक बिल"
        title="Monthly Bills"
        hint="Regular customers are billed from delivered subscription milk. Daily / walk-in customers are billed only from actual purchases."
      />
      <Card className="grid gap-3 p-4 md:grid-cols-2">
        <Field label="Year">
          <input className={inputClass} type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </Field>
        <Field label="Month">
          <select className={inputClass} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2026, i, 1).toLocaleString("en-IN", { month: "long" })}
              </option>
            ))}
          </select>
        </Field>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-line/70 md:hidden">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : bills.length === 0 ? (
            <EmptyState title="No bill activity this month" hint="Deliver milk or record a payment to populate the monthly bill." />
          ) : (
            bills.map((bill) => (
              <div key={bill.id} className="px-4 py-3">
                <p className="font-medium">{bill.customer.name}</p>
                <p className="font-mono text-[11px] text-muted">{bill.customer.customerCode}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                  <span>Delivered {formatQty(bill.totalDelivered)}</span>
                  <span>Extra {formatQty(bill.extraMilk)}</span>
                  <span>Skipped {bill.skippedDays}</span>
                  <span>Paid {formatInr(bill.paidAmount)}</span>
                </div>
                <p className="mt-2 text-[13px] font-semibold">Due {formatInr(bill.outstanding)}</p>
              </div>
            ))
          )}
        </div>
        <div className="table-scroll hidden md:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="py-2.5 font-medium">Delivered milk</th>
                <th className="py-2.5 font-medium">Total amount</th>
                <th className="py-2.5 font-medium">Skipped days</th>
                <th className="py-2.5 font-medium">Extra milk</th>
                <th className="py-2.5 font-medium">Paid</th>
                <th className="px-4 py-2.5 font-medium">Outstanding</th>
              </tr>
            </thead>
            {loading ? (
              <LoadingRows cols={7} />
            ) : (
              <tbody>
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="No bill activity this month" hint="Deliver milk or record a payment to populate the monthly bill." />
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => (
                    <tr key={bill.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                      <td className="px-4 py-2.5">
                        <span className="block font-medium">{bill.customer.name}</span>
                        <span className="font-mono text-[11px] text-muted">{bill.customer.customerCode}</span>
                      </td>
                      <td>{formatQty(bill.totalDelivered)}</td>
                      <td className="font-semibold">{formatInr(bill.totalAmount)}</td>
                      <td>{bill.skippedDays}</td>
                      <td>{formatQty(bill.extraMilk)}</td>
                      <td>{formatInr(bill.paidAmount)}</td>
                      <td className="px-4 font-semibold">{formatInr(bill.outstanding)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}

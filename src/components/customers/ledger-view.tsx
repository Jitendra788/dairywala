"use client";

import { useEffect, useState } from "react";
import { customerApi } from "@/lib/customers/client";
import type { CustomerRow, LedgerRow } from "@/lib/customers/types";
import { addDays, formatDate, todayISO } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import { useToast } from "@/components/toast";
import { Card, Field, inputClass, PageHeader } from "@/components/ui";
import { DeliveryStatusBadge, EmptyState, LoadingRows } from "@/components/customers/shared";

export function MilkLedgerView() {
  const toast = useToast();
  const [from, setFrom] = useState(addDays(todayISO(), -14));
  const [to, setTo] = useState(todayISO());
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to });
      if (customerId) qs.set("customerId", customerId);
      const [ledger, list] = await Promise.all([
        customerApi<{ rows: LedgerRow[] }>(`/api/ledger?${qs}`),
        customerApi<{ customers: CustomerRow[] }>("/api/customers"),
      ]);
      setRows(ledger.rows);
      setCustomers(list.customers);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not load ledger", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [from, to, customerId]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        kicker="दूध खाता"
        title="Milk Ledger"
        hint="Date-wise regular, extra and delivered quantity from the same customer subscription."
      />
      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <Field label="From">
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Customer">
          <select className={inputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.customerCode} · {c.name}
              </option>
            ))}
          </select>
        </Field>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-line/70 md:hidden">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState title="Ledger is empty" hint="Deliver, skip or mark extra milk — each action posts one ledger line." />
          ) : (
            rows.map((row) => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{row.customer.name}</p>
                    <p className="text-[12px] text-muted">{formatDate(row.date)}</p>
                  </div>
                  <DeliveryStatusBadge status={row.status} />
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  Regular {formatQty(row.regularQty)} · Extra {formatQty(row.extraQty)} · Delivered {formatQty(row.deliveredQty)}
                </p>
                <p className="mt-1 text-[13px] font-semibold">{formatInr(row.amount)}</p>
              </div>
            ))
          )}
        </div>
        <div className="table-scroll hidden md:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="py-2.5 font-medium">Customer</th>
                <th className="py-2.5 font-medium">Regular</th>
                <th className="py-2.5 font-medium">Extra</th>
                <th className="py-2.5 font-medium">Delivered</th>
                <th className="py-2.5 font-medium">Rate</th>
                <th className="py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            {loading ? (
              <LoadingRows cols={8} />
            ) : (
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState title="Ledger is empty" hint="Deliver, skip or mark extra milk — each action posts one ledger line." />
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                      <td className="px-4 py-2.5">{formatDate(row.date)}</td>
                      <td>
                        <span className="block font-medium">{row.customer.name}</span>
                        <span className="font-mono text-[11px] text-muted">{row.customer.customerCode}</span>
                      </td>
                      <td>{formatQty(row.regularQty)}</td>
                      <td>{formatQty(row.extraQty)}</td>
                      <td className="font-semibold">{formatQty(row.deliveredQty)}</td>
                      <td>{formatInr(row.rate)}</td>
                      <td className="font-semibold">{formatInr(row.amount)}</td>
                      <td className="px-4">
                        <DeliveryStatusBadge status={row.status} />
                      </td>
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

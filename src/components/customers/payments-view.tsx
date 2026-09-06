"use client";

import { useEffect, useState } from "react";
import { customerApi } from "@/lib/customers/client";
import type { CustomerRow, PaymentMode, PaymentRow } from "@/lib/customers/types";
import { formatDate, todayISO } from "@/lib/dates";
import { formatInr } from "@/lib/money";
import { useToast } from "@/components/toast";
import { btnPrimary, Card, Field, inputClass, PageHeader } from "@/components/ui";
import { EmptyState, LoadingRows } from "@/components/customers/shared";

export function CustomerPaymentsView() {
  const toast = useToast();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    date: todayISO(),
    amount: "",
    mode: "cash" as PaymentMode,
    reference: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [list, pay] = await Promise.all([
        customerApi<{ customers: CustomerRow[] }>("/api/customers"),
        customerApi<{ payments: PaymentRow[] }>("/api/customer-payments"),
      ]);
      setCustomers(list.customers);
      setPayments(pay.payments);
      setForm((prev) => ({ ...prev, customerId: prev.customerId || list.customers[0]?.id || "" }));
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not load payments", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = customers.find((c) => c.id === form.customerId);

  async function save() {
    setBusy(true);
    try {
      await customerApi("/api/customer-payments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });
      toast.push("Payment recorded");
      setForm((prev) => ({ ...prev, amount: "", reference: "" }));
      await load();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Payment failed", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        kicker="ग्राहक भुगतान"
        title="Payments"
        hint="Record money against the customer account. Remaining balance is billed milk minus payments."
      />
      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Customer">
            <select className={inputClass} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customerCode} · {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment date">
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Amount">
            <input type="number" min="1" className={inputClass} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Payment mode">
            <select className={inputClass} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as PaymentMode })}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank</option>
              <option value="card">Card</option>
            </select>
          </Field>
          <Field label="Reference">
            <input className={inputClass} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="UPI / slip no." />
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Current outstanding: <span className="font-semibold text-foreground">{formatInr(selected?.outstanding ?? 0)}</span>
          </p>
          <button type="button" className={`${btnPrimary} w-full sm:w-auto`} disabled={busy || !form.customerId} onClick={() => void save()}>
            {busy ? "Saving…" : "Record payment"}
          </button>
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-line/70 md:hidden">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : payments.length === 0 ? (
            <EmptyState title="No payments yet" hint="Collect cash or UPI against an outstanding customer bill." />
          ) : (
            payments.map((row) => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.customer.name}</p>
                    <p className="text-[12px] text-muted">{formatDate(row.date)} · {row.mode}</p>
                  </div>
                  <p className="text-[13px] font-semibold">{formatInr(row.amount)}</p>
                </div>
                <p className="mt-1 text-[12px] text-muted">Remaining {formatInr(row.remainingBalance)}</p>
              </div>
            ))
          )}
        </div>
        <div className="table-scroll hidden md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="py-2.5 font-medium">Customer</th>
                <th className="py-2.5 font-medium">Amount</th>
                <th className="py-2.5 font-medium">Mode</th>
                <th className="py-2.5 font-medium">Reference</th>
                <th className="px-4 py-2.5 font-medium">Remaining balance</th>
              </tr>
            </thead>
            {loading ? (
              <LoadingRows cols={6} />
            ) : (
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title="No payments yet" hint="Collect cash or UPI against an outstanding customer bill." />
                    </td>
                  </tr>
                ) : (
                  payments.map((row) => (
                    <tr key={row.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                      <td className="px-4 py-2.5">{formatDate(row.date)}</td>
                      <td>
                        <span className="block font-medium">{row.customer.name}</span>
                        <span className="font-mono text-[11px] text-muted">{row.customer.customerCode}</span>
                      </td>
                      <td className="font-semibold">{formatInr(row.amount)}</td>
                      <td className="capitalize">{row.mode}</td>
                      <td className="text-muted">{row.reference || "—"}</td>
                      <td className="px-4 font-semibold">{formatInr(row.remainingBalance)}</td>
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

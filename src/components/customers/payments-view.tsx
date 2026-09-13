"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { customerApi } from "@/lib/customers/client";
import type { CustomerRow, PaymentMode, PaymentRow } from "@/lib/customers/types";
import { formatDate, todayISO } from "@/lib/dates";
import { formatInr } from "@/lib/money";
import { useI18n } from "@/hooks/use-i18n";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, Card, Field, inputClass, PageHeader, Select } from "@/components/ui";
import { EmptyState, LoadingRows } from "@/components/customers/shared";

export function CustomerPaymentsView() {
  const { t } = useI18n();
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

  useEffect(() => {
    let live = true;
    Promise.all([
      customerApi<{ customers: CustomerRow[] }>("/api/customers"),
      customerApi<{ payments: PaymentRow[] }>("/api/customers/payments"),
    ])
      .then(([list, pay]) => {
        if (!live) return;
        setCustomers(list.customers);
        setPayments(pay.payments);
        setForm((prev) => ({ ...prev, customerId: prev.customerId || list.customers[0]?.id || "" }));
      })
      .catch((e) => toast.push(e instanceof Error ? e.message : t("noCustomerPay"), "err"))
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const selected = customers.find((c) => c.id === form.customerId);

  async function save() {
    const amount = Number(form.amount);
    if (!form.customerId || !amount) return;
    setBusy(true);
    try {
      const data = await customerApi<{ payment: PaymentRow }>("/api/customers/payments", {
        method: "POST",
        body: JSON.stringify({ ...form, amount }),
      });
      setPayments((prev) => [data.payment, ...prev]);
      setCustomers((prev) =>
        prev.map((c) => (c.id === data.payment.customerId ? { ...c, outstanding: data.payment.remainingBalance } : c)),
      );
      setForm((prev) => ({ ...prev, amount: "", reference: "" }));
      toast.push(t("paid"));
    } catch (e) {
      toast.push(e instanceof Error ? e.message : t("resetFailed"), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        kicker={t("payHubKicker")}
        title={t("customerPayTitle")}
        hint={t("customerPayHint")}
        actions={
          <Link href="/payments" className={btnGhost}>
            {t("backPayments")}
          </Link>
        }
      />
      <div className="chip-row">
        <Link href="/payments?tab=bills" className={btnGhost}>
          {t("farmerPayments")}
        </Link>
        <Link href="/customers/payments" className={btnPrimary}>
          {t("customerPayments")}
        </Link>
        <Link href="/payments?tab=advances" className={btnGhost}>
          {t("advances")}
        </Link>
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-[13px] text-foreground/80">
        {t("customerPayHint")}
      </div>
      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label={t("customer")}>
            <Select className={inputClass} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customerCode} · {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("paymentDate")}>
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label={t("amount")}>
            <input type="number" min="1" className={inputClass} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label={t("paymentMode")}>
            <Select className={inputClass} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as PaymentMode })}>
              <option value="cash">{t("cash")}</option>
              <option value="upi">{t("upi")}</option>
              <option value="bank">{t("bank")}</option>
              <option value="card">{t("card")}</option>
            </Select>
          </Field>
          <Field label={t("reference")}>
            <input className={inputClass} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {t("outstanding")}: <span className="font-semibold text-foreground">{formatInr(selected?.outstanding ?? 0)}</span>
          </p>
          <button type="button" className={`${btnPrimary} w-full sm:w-auto`} disabled={busy || !form.customerId || !Number(form.amount)} onClick={() => void save()}>
            {busy ? t("collecting") : t("collectNow")}
          </button>
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-line/70 md:hidden">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{t("loading")}</p>
          ) : payments.length === 0 ? (
            <EmptyState title={t("noCustomerPay")} hint={t("customerPayHint")} />
          ) : (
            payments.map((row) => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.customer.name}</p>
                    <p className="text-[12px] text-muted">{formatDate(row.date)} · {row.mode}</p>
                    <p className="font-mono text-[11px] text-muted">{row.reference || "—"}</p>
                  </div>
                  <p className="text-[13px] font-semibold">{formatInr(row.amount)}</p>
                </div>
                <p className="mt-1 text-[12px] text-muted">{t("remaining")} {formatInr(row.remainingBalance)}</p>
              </div>
            ))
          )}
        </div>
        <div className="table-scroll hidden md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("paymentDate")}</th>
                <th className="py-2.5 font-medium">{t("navCustomers")}</th>
                <th className="py-2.5 font-medium">{t("amount")}</th>
                <th className="py-2.5 font-medium">{t("paymentMode")}</th>
                <th className="py-2.5 font-medium">{t("reference")}</th>
                <th className="px-4 py-2.5 font-medium">{t("remaining")}</th>
              </tr>
            </thead>
            {loading ? (
              <LoadingRows cols={6} />
            ) : (
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title={t("noCustomerPay")} hint={t("customerPayHint")} />
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

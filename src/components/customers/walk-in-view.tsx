"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { customerApi } from "@/lib/customers/client";
import type {
  CustomerMilkType,
  CustomerRow,
  DeliveryRow,
  PaymentMode,
  SalePaymentStatus,
  WalkInTotals,
} from "@/lib/customers/types";
import { formatTime, todayISO } from "@/lib/dates";
import { formatInr, formatQty, round2 } from "@/lib/money";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { btnGhost, btnPrimary, Card, Field, Initials, MilkBadge, inputClass, PageHeader } from "@/components/ui";
import { EmptyState, LoadingRows, SalePaymentBadge } from "@/components/customers/shared";

type SaleForm = {
  milkType: CustomerMilkType;
  quantity: string;
  rate: string;
  paymentStatus: SalePaymentStatus;
  paymentMode: PaymentMode;
  paidAmount: string;
  notes: string;
};

const emptySale = (rate = "60"): SaleForm => ({
  milkType: "cow",
  quantity: "",
  rate,
  paymentStatus: "paid",
  paymentMode: "cash",
  paidAmount: "",
  notes: "",
});

export function WalkInView() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const qtyRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(todayISO());
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<CustomerRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [sales, setSales] = useState<DeliveryRow[]>([]);
  const [totals, setTotals] = useState<WalkInTotals>({ customers: 0, qty: 0, sales: 0, paid: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<SaleForm>(emptySale());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<DeliveryRow | null>(null);
  const [deleting, setDeleting] = useState<DeliveryRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    mobile: "",
    address: "",
    milkType: "cow" as CustomerMilkType,
  });

  const amount = useMemo(() => {
    const qty = Number(form.quantity);
    const rate = Number(form.rate);
    if (!Number.isFinite(qty) || !Number.isFinite(rate) || qty <= 0 || rate < 0) return 0;
    return round2(qty * rate);
  }, [form.quantity, form.rate]);

  async function loadSales(forDate = date) {
    setLoading(true);
    try {
      const data = await customerApi<{ sales: DeliveryRow[]; totals: WalkInTotals }>(
        `/api/walk-in-sales?date=${forDate}`,
      );
      setSales(data.sales);
      setTotals(data.totals);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not load walk-in sales", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSales(date);
  }, [date]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const t = window.setTimeout(() => {
      setSearching(true);
      customerApi<{ customers: CustomerRow[] }>(`/api/customers?type=walkin&q=${encodeURIComponent(q)}`)
        .then((data) => setMatches(data.customers))
        .catch(() => setMatches([]))
        .finally(() => setSearching(false));
    }, 180);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const preset = searchParams.get("customerId");
    if (!preset) return;
    customerApi<{ customer: CustomerRow }>(`/api/customers/${preset}`)
      .then((data) => {
        if (data.customer.customerType === "walkin") selectCustomer(data.customer);
      })
      .catch(() => undefined);
  }, [searchParams]);

  function selectCustomer(row: CustomerRow) {
    setSelected(row);
    setQuery("");
    setMatches([]);
    setShowNew(false);
    const todaySale = sales.find((sale) => sale.customerId === row.id);
    if (todaySale) {
      fillFromSale(todaySale);
    } else {
      setEditingId(null);
      setForm({
        ...emptySale(row.defaultRate > 0 ? String(row.defaultRate) : "60"),
        milkType: row.milkType,
        quantity: row.defaultQty > 0 ? String(row.defaultQty) : "",
      });
    }
    window.setTimeout(() => qtyRef.current?.focus(), 30);
  }

  function fillFromSale(sale: DeliveryRow) {
    setEditingId(sale.id);
    setSelected({
      ...sale.customer,
      subscription: sale.subscription,
      todayDelivery: sale,
      outstanding: 0,
    });
    setForm({
      milkType: sale.milkType || sale.customer.milkType,
      quantity: String(sale.deliveredQty),
      rate: String(sale.rate),
      paymentStatus: sale.paymentStatus ?? "paid",
      paymentMode: sale.paymentMode ?? "cash",
      paidAmount: sale.paymentStatus === "partial" ? String(sale.paidAmount) : "",
      notes: sale.notes ?? "",
    });
  }

  function resetSale() {
    setSelected(null);
    setEditingId(null);
    setForm(emptySale());
    setQuery("");
    searchRef.current?.focus();
  }

  async function saveSale(e?: FormEvent) {
    e?.preventDefault();
    if (!selected) {
      toast.push("Select a customer first", "err");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        customerId: selected.id,
        date,
        milkType: form.milkType,
        quantity: Number(form.quantity),
        rate: Number(form.rate),
        paymentStatus: form.paymentStatus,
        paymentMode: form.paymentMode,
        paidAmount: form.paymentStatus === "partial" ? Number(form.paidAmount) : undefined,
        notes: form.notes,
      };
      if (editingId) {
        await customerApi(`/api/walk-in-sales/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.push("Sale updated");
      } else {
        await customerApi("/api/walk-in-sales", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.push("Today’s sale saved");
      }
      await loadSales();
      resetSale();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save sale", "err");
    } finally {
      setBusy(false);
    }
  }

  async function createDailyCustomer() {
    setBusy(true);
    try {
      const data = await customerApi<{ customer: CustomerRow }>("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          ...newCustomer,
          customerType: "walkin",
        }),
      });
      toast.push(`${data.customer.customerCode} created`);
      setNewCustomer({ name: "", mobile: "", address: "", milkType: "cow" });
      selectCustomer(data.customer);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not add customer", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeSale() {
    if (!deleting) return;
    setBusy(true);
    try {
      await customerApi(`/api/walk-in-sales/${deleting.id}`, { method: "DELETE" });
      toast.push("Sale deleted");
      if (editingId === deleting.id) resetSale();
      setDeleting(null);
      await loadSales();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not delete sale", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        kicker="दैनिक बिक्री"
        title="Daily / Walk-in Milk Sales"
        hint="Sell milk only when the customer is here. Same mobile keeps one customer record."
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <MiniStat label="Customers" value={String(totals.customers)} />
        <MiniStat label="Milk sold" value={formatQty(totals.qty)} />
        <MiniStat label="Sales" value={formatInr(totals.sales)} />
        <MiniStat label="Paid" value={formatInr(totals.paid)} />
        <MiniStat label="Pending" value={formatInr(totals.pending)} />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
          <Field label="Date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Search existing customer">
            <input
              ref={searchRef}
              className={inputClass}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, mobile or CUS-0012"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches.length === 1) {
                  e.preventDefault();
                  selectCustomer(matches[0]);
                }
              }}
            />
          </Field>
          <div className="flex items-end">
            <button type="button" className={btnPrimary} onClick={() => setShowNew((v) => !v)}>
              {showNew ? "Close" : "+ New Customer"}
            </button>
          </div>
        </div>
        {query.trim().length >= 2 ? (
          <div className="mt-3 divide-y divide-line/70 overflow-hidden rounded-2xl border border-line">
            {searching ? (
              <p className="px-4 py-3 text-sm text-muted">Searching…</p>
            ) : matches.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <p className="text-sm text-muted">No walk-in customer found.</p>
                <button type="button" className={btnGhost} onClick={() => setShowNew(true)}>
                  Add New Daily Customer
                </button>
              </div>
            ) : (
              matches.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#faf6ee]"
                  onClick={() => selectCustomer(row)}
                >
                  <Initials name={row.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{row.name}</span>
                    <span className="font-mono text-[11px] text-muted">
                      {row.customerCode} · {row.mobile}
                    </span>
                  </span>
                  <MilkBadge type={row.milkType} />
                </button>
              ))
            )}
          </div>
        ) : null}

        {showNew ? (
          <div className="mt-4 rounded-2xl bg-[#f7f1e6] p-4">
            <p className="mb-3 font-display text-lg">Add New Daily Customer</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name">
                <input className={inputClass} value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Ramesh" />
              </Field>
              <Field label="Mobile">
                <input className={inputClass} value={newCustomer.mobile} onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })} placeholder="9876502012" inputMode="numeric" />
              </Field>
              <Field label="Address (optional)">
                <input className={inputClass} value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
              </Field>
              <Field label="Default milk type">
                <select className={inputClass} value={newCustomer.milkType} onChange={(e) => setNewCustomer({ ...newCustomer, milkType: e.target.value as CustomerMilkType })}>
                  <option value="cow">Cow</option>
                  <option value="buffalo">Buffalo</option>
                  <option value="mixed">Mixed</option>
                </select>
              </Field>
            </div>
            <button type="button" className={`${btnPrimary} mt-4`} disabled={busy} onClick={() => void createDailyCustomer()}>
              Save customer and sell milk
            </button>
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg">{editingId ? "Edit sale" : "Quick milk sale"}</h2>
          {selected ? (
            <p className="text-[12px] text-muted">
              {selected.customerCode} · {selected.name}
            </p>
          ) : null}
        </div>
        <form onSubmit={(e) => void saveSale(e)} className="grid gap-3 md:grid-cols-3">
          <Field label="Customer">
            <input className={inputClass} readOnly value={selected ? `${selected.name} · ${selected.mobile}` : "Search or add a customer"} />
          </Field>
          <Field label="Milk type">
            <select className={inputClass} value={form.milkType} onChange={(e) => setForm({ ...form, milkType: e.target.value as CustomerMilkType })}>
              <option value="cow">Cow</option>
              <option value="buffalo">Buffalo</option>
              <option value="mixed">Mixed</option>
            </select>
          </Field>
          <Field label="Quantity (L)">
            <input
              ref={qtyRef}
              className={inputClass}
              type="number"
              min="0.1"
              step="0.1"
              inputMode="decimal"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="3"
            />
          </Field>
          <Field label="Rate (₹/L)">
            <input
              className={inputClass}
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
            />
          </Field>
          <Field label="Amount">
            <input className={inputClass} readOnly value={amount ? formatInr(amount) : "Qty × Rate"} />
          </Field>
          <Field label="Payment status">
            <select
              className={inputClass}
              value={form.paymentStatus}
              onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as SalePaymentStatus })}
            >
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
            </select>
          </Field>
          <Field label="Payment mode">
            <select className={inputClass} value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value as PaymentMode })}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </Field>
          {form.paymentStatus === "partial" ? (
            <Field label="Paid amount">
              <input
                className={inputClass}
                type="number"
                min="0.01"
                step="0.5"
                value={form.paidAmount}
                onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
              />
            </Field>
          ) : null}
          <Field label="Notes (optional)">
            <input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex items-end gap-2 md:col-span-3">
            <button type="submit" className={btnPrimary} disabled={busy || !selected}>
              {busy ? "Saving…" : editingId ? "Update sale" : "Save Today's Sale"}
            </button>
            <button type="button" className={btnGhost} onClick={resetSale}>
              Clear
            </button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-display text-lg">Today’s walk-in list</h2>
        </div>
        <div className="divide-y divide-line/70 md:hidden">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : sales.length === 0 ? (
            <EmptyState title="No walk-in sales yet" hint="Search a customer and save today’s sale." />
          ) : (
            sales.map((row) => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.customer.name}</p>
                    <p className="text-[12px] text-muted">{formatTime(row.createdAt)}</p>
                  </div>
                  <SalePaymentBadge status={row.paymentStatus} />
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  <MilkBadge type={row.milkType || row.customer.milkType} /> · {formatQty(row.deliveredQty)} · {formatInr(row.rate)}
                </p>
                <p className="mt-1 font-semibold">{formatInr(row.amount)}</p>
                <div className="mt-2 flex gap-1">
                  <IconBtn label="View" onClick={() => setViewing(row)}><Eye size={14} /></IconBtn>
                  <IconBtn label="Edit" onClick={() => fillFromSale(row)}><Pencil size={14} /></IconBtn>
                  <IconBtn label="Delete" onClick={() => setDeleting(row)}><Trash2 size={14} /></IconBtn>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="table-scroll hidden md:block">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="py-2.5 font-medium">Milk type</th>
                <th className="py-2.5 font-medium">Quantity</th>
                <th className="py-2.5 font-medium">Rate</th>
                <th className="py-2.5 font-medium">Amount</th>
                <th className="py-2.5 font-medium">Payment</th>
                <th className="py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            {loading ? (
              <LoadingRows cols={8} />
            ) : (
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState title="No walk-in sales yet" hint="Search a customer and save today’s sale." />
                    </td>
                  </tr>
                ) : (
                  sales.map((row) => (
                    <tr key={row.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                      <td className="px-4 py-2.5">
                        <span className="block font-medium">{row.customer.name}</span>
                        <span className="font-mono text-[11px] text-muted">{row.customer.customerCode}</span>
                      </td>
                      <td>
                        <MilkBadge type={row.milkType || row.customer.milkType} />
                      </td>
                      <td>{formatQty(row.deliveredQty)}</td>
                      <td>{formatInr(row.rate)}</td>
                      <td className="font-semibold">{formatInr(row.amount)}</td>
                      <td>
                        <SalePaymentBadge status={row.paymentStatus} />
                      </td>
                      <td>{formatTime(row.createdAt)}</td>
                      <td className="px-4 text-right">
                        <IconBtn label="View" onClick={() => setViewing(row)}><Eye size={14} /></IconBtn>
                        <IconBtn label="Edit" onClick={() => fillFromSale(row)}><Pencil size={14} /></IconBtn>
                        <IconBtn label="Delete" onClick={() => setDeleting(row)}><Trash2 size={14} /></IconBtn>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            )}
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(viewing)}
        title={viewing ? viewing.customer.name : "Sale"}
        confirmLabel="Close"
        onClose={() => setViewing(null)}
        onConfirm={() => setViewing(null)}
      >
        {viewing ? (
          <div className="space-y-1 text-sm text-ink">
            <p>{viewing.customer.customerCode} · {viewing.customer.mobile}</p>
            <p>{viewing.milkType || viewing.customer.milkType} · {formatQty(viewing.deliveredQty)} × {formatInr(viewing.rate)}</p>
            <p className="font-semibold">{formatInr(viewing.amount)}</p>
            <p>Payment: {viewing.paymentStatus ?? "—"} · {viewing.paymentMode ?? "—"}</p>
            {viewing.notes ? <p>Notes: {viewing.notes}</p> : null}
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete sale for ${deleting?.customer.name ?? "customer"}?`}
        confirmLabel="Delete sale"
        danger
        busy={busy}
        onClose={() => setDeleting(null)}
        onConfirm={() => void removeSale()}
      >
        This removes today’s walk-in transaction, ledger line and linked payment. The customer record stays.
      </ConfirmDialog>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-[22px] leading-none">{value}</p>
    </Card>
  );
}

function IconBtn({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-[#f4ead6] hover:text-primary" onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

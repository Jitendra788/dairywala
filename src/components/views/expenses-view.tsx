"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { customerApi } from "@/lib/customers/client";
import { formatDate, todayISO } from "@/lib/dates";
import { formatInr, round2 } from "@/lib/money";
import { expenseRef } from "@/lib/ref";
import { useToast } from "@/components/toast";
import {
  btnGhost,
  btnPrimary,
  Card,
  Field,
  confirmAction,
  inputClass,
  PageHeader,
  Select,
} from "@/components/ui";
import { EmptyState, LoadingRows } from "@/components/customers/shared";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseStatus } from "@/lib/finance/types";

const emptyForm = {
  date: todayISO(),
  category: "Fuel",
  amount: "",
  spentBy: "",
  remark: "",
  status: "paid" as ExpenseStatus,
};

export function ExpensesView() {
  const toast = useToast();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [q, setQ] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    try {
      const data = await customerApi<{ expenses: Expense[] }>(
        `/api/expenses?from=${from}&to=${to}${includeDeleted ? "&includeDeleted=1" : ""}`,
      );
      setRows(data.expenses);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not load expenses", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [from, to, includeDeleted]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (row) =>
        row.category.toLowerCase().includes(s) ||
        row.spentBy.toLowerCase().includes(s) ||
        row.remark.toLowerCase().includes(s) ||
        expenseRef(row.id).toLowerCase().includes(s),
    );
  }, [rows, q]);

  const total = round2(visible.reduce((s, row) => s + row.amount, 0));

  function startAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, date: from });
    setOpen(true);
  }

  function startEdit(row: Expense) {
    setEditingId(row.id);
    setForm({
      date: row.date,
      category: row.category,
      amount: String(row.amount),
      spentBy: row.spentBy,
      remark: row.remark,
      status: row.status,
    });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
      };
      if (editingId) {
        await customerApi(`/api/expenses/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.push("Expense updated");
      } else {
        await customerApi("/api/expenses", { method: "POST", body: JSON.stringify(payload) });
        toast.push("Expense saved");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Expense) {
    if (!confirmAction("Is expense ko delete karein?")) return;
    try {
      await customerApi(`/api/expenses/${row.id}`, { method: "DELETE" });
      toast.push("Expense deleted");
      await load();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Delete failed", "err");
    }
  }

  function downloadCsv() {
    const lines = [
      ["Reference", "Date", "Category", "Spent by", "Amount", "Status", "Remark"].join(","),
      ...visible.map((row) =>
        [
          expenseRef(row.id),
          formatDate(row.date),
          row.category,
          row.spentBy,
          row.amount,
          row.status,
          `"${row.remark.replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        kicker="खर्च"
        title="Expenses"
        hint="Track all business expenses across categories. Dates show as dd/mm/yyyy."
        actions={
          <button type="button" className={btnPrimary} onClick={startAdd}>
            <Plus size={16} />
            Add expense
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-medium text-muted">Total expenses</p>
          <p className="mt-1 font-display text-3xl">{formatInr(total)}</p>
          <p className="mt-1 text-[12px] text-muted">
            {formatDate(from)} – {formatDate(to)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium text-muted">Records</p>
          <p className="mt-1 font-display text-3xl">{visible.length}</p>
          <p className="mt-1 text-[12px] text-muted">Individual expenses</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium text-muted">This page</p>
          <p className="mt-1 font-display text-3xl">{formatInr(total)}</p>
          <p className="mt-1 text-[12px] text-muted">Subtotal</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="From">
              <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Search">
              <input
                className={inputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Category, person, remark"
              />
            </Field>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-[#fbf7ef] px-3 py-2 text-sm">
              <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
              <span>Include deleted</span>
            </label>
            <button type="button" className={`${btnGhost} shrink-0`} onClick={downloadCsv}>
              <Download size={15} />
              Download Excel
            </button>
          </div>
        </div>
      </Card>

      {open ? (
        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg">{editingId ? "Update expense" : "Add expense"}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Date">
              <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Category">
              <Select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount">
              <input className={inputClass} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Spent by">
              <input className={inputClass} value={form.spentBy} onChange={(e) => setForm({ ...form, spentBy: e.target.value })} placeholder="Name" />
            </Field>
            <Field label="Status">
              <Select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ExpenseStatus })}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </Select>
            </Field>
            <Field label="Remark">
              <input className={inputClass} value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : editingId ? "Update" : "Save expense"}
            </button>
            <button type="button" className={btnGhost} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-line/70 md:hidden">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <EmptyState title="No expenses" hint="Add fuel, salary, rent or any dairy cost." />
          ) : (
            visible.map((row) => (
              <div key={row.id} className={`px-4 py-3 ${row.deletedAt ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.category}</p>
                    <p className="font-mono text-[11px] text-muted">{expenseRef(row.id)}</p>
                    <p className="text-[12px] text-muted">
                      {formatDate(row.date)} · {row.spentBy || "—"} · {row.status}
                    </p>
                  </div>
                  <p className="text-[13px] font-semibold">{formatInr(row.amount)}</p>
                </div>
                {row.remark ? <p className="mt-1 text-[12px] text-muted">{row.remark}</p> : null}
                {!row.deletedAt ? (
                  <div className="mt-2">
                    <button type="button" className="mr-1 rounded-lg p-1.5 text-muted hover:bg-[#f4ead6]" onClick={() => startEdit(row)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger" onClick={() => void remove(row)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
        <div className="table-scroll hidden md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="table-head text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Reference</th>
                <th className="py-2.5 font-medium">Category</th>
                <th className="py-2.5 font-medium">Spent by</th>
                <th className="py-2.5 font-medium">Date</th>
                <th className="py-2.5 font-medium">Amount</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            {loading ? (
              <LoadingRows cols={7} />
            ) : (
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="No expenses" hint="Add fuel, salary, rent or any dairy cost." />
                    </td>
                  </tr>
                ) : (
                  visible.map((row) => (
                    <tr key={row.id} className={`border-t border-line/70 hover:bg-[#faf6ee] ${row.deletedAt ? "opacity-50" : ""}`}>
                      <td className="px-4 py-2.5 font-mono text-xs">{expenseRef(row.id)}</td>
                      <td>
                        <span className="block font-medium">{row.category}</span>
                        {row.remark ? <span className="text-[11px] text-muted">{row.remark}</span> : null}
                      </td>
                      <td>{row.spentBy || "—"}</td>
                      <td>{formatDate(row.date)}</td>
                      <td className="font-semibold">{formatInr(row.amount)}</td>
                      <td className="capitalize">{row.status}</td>
                      <td className="px-4 text-right">
                        {!row.deletedAt ? (
                          <>
                            <button type="button" className="mr-1 rounded-lg p-1.5 text-muted hover:bg-[#f4ead6]" onClick={() => startEdit(row)}>
                              <Pencil size={14} />
                            </button>
                            <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger" onClick={() => void remove(row)}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted">Deleted</span>
                        )}
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

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pause, Pencil, Play } from "lucide-react";
import { customerApi } from "@/lib/customers/client";
import type { CustomerMilkType, CustomerRow, CustomerStatus, CustomerType } from "@/lib/customers/types";
import { formatInr, formatQty } from "@/lib/money";
import { addDays, todayISO } from "@/lib/dates";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  btnGhost,
  btnPrimary,
  Card,
  Field,
  Initials,
  MilkBadge,
  inputClass,
  PageHeader,
  Select,
} from "@/components/ui";
import { CustomerStatusBadge, CustomerTypeBadge, EmptyState, LoadingRows } from "@/components/customers/shared";

export function AllCustomersView() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | CustomerType>("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [milk, setMilk] = useState<"all" | CustomerMilkType>("all");
  const [payment, setPayment] = useState<"all" | "pending" | "clear">("all");
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [pauseRow, setPauseRow] = useState<CustomerRow | null>(null);
  const [pauseFrom, setPauseFrom] = useState(todayISO());
  const [resumeDate, setResumeDate] = useState(addDays(todayISO(), 3));
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    address: "",
    milkType: "buffalo" as "cow" | "buffalo" | "mixed",
    dailyQty: "",
    rate: "",
    deliveryTime: "06:30",
    paymentCycle: "monthly",
    status: "active" as CustomerStatus,
  });

  async function load() {
    setLoading(true);
    try {
      const data = await customerApi<{ customers: CustomerRow[] }>("/api/customers");
      setRows(data.customers);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not load customers", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const next = searchParams.get("type");
    if (next === "regular" || next === "walkin") setType(next);
    else setType("all");
  }, [searchParams]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (type !== "all" && row.customerType !== type) return false;
      if (status === "active" && row.status !== "active") return false;
      if (status === "inactive" && row.status === "active") return false;
      if (milk !== "all" && row.milkType !== milk) return false;
      if (payment === "pending" && row.outstanding <= 0) return false;
      if (payment === "clear" && row.outstanding > 0) return false;
      if (!s) return true;
      return (
        row.name.toLowerCase().includes(s) ||
        row.mobile.includes(s) ||
        row.customerCode.toLowerCase().includes(s) ||
        row.address.toLowerCase().includes(s)
      );
    });
  }, [rows, q, type, status, milk, payment]);

  function startEdit(row: CustomerRow) {
    setEditing(row);
    setForm({
      name: row.name,
      mobile: row.mobile,
      address: row.address,
      milkType: row.milkType,
      dailyQty: String(row.subscription?.dailyQty ?? row.defaultQty ?? ""),
      rate: String(row.subscription?.rate ?? row.defaultRate ?? ""),
      deliveryTime: row.subscription?.deliveryTime ?? "06:30",
      paymentCycle: row.subscription?.paymentCycle ?? "monthly",
      status: row.status,
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await customerApi(`/api/customers/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          dailyQty: Number(form.dailyQty),
          rate: Number(form.rate),
        }),
      });
      toast.push("Customer updated");
      setEditing(null);
      await load();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function applyPause() {
    if (!pauseRow) return;
    setBusy(true);
    try {
      await customerApi(`/api/customers/${pauseRow.id}/pause`, {
        method: "POST",
        body: JSON.stringify({ pauseFrom, resumeDate }),
      });
      toast.push(`${pauseRow.name} paused till ${resumeDate}`);
      setPauseRow(null);
      await load();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Pause failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function resume(row: CustomerRow) {
    setBusy(true);
    try {
      await customerApi(`/api/customers/${row.id}/resume`, { method: "POST" });
      toast.push(`${row.name} resumed`);
      await load();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Resume failed", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        kicker="ग्राहक"
        title={type === "regular" ? "Regular Customers" : type === "walkin" ? "Daily / Walk-in Customers" : "All Customers"}
        hint="Regular customers have a daily subscription. Daily / walk-in customers are billed only on the days they buy milk."
        actions={
          <Link href="/customers/new" className={btnPrimary}>
            Add customer
          </Link>
        }
      />

      {editing ? (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Edit {editing.customerCode}</h2>
            <button type="button" className="text-xs text-muted" onClick={() => setEditing(null)}>
              Close
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Customer name">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Mobile (optional)">
              <input className={inputClass} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="Optional" inputMode="numeric" />
            </Field>
            <Field label="Address">
              <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Milk type">
              <Select className={inputClass} value={form.milkType} onChange={(e) => setForm({ ...form, milkType: e.target.value as typeof form.milkType })}>
                <option value="cow">Cow</option>
                <option value="buffalo">Buffalo</option>
                <option value="mixed">Mixed</option>
              </Select>
            </Field>
            {editing.customerType === "regular" ? (
              <>
                <Field label="Daily quantity">
                  <input className={inputClass} type="number" min="0.1" step="0.1" value={form.dailyQty} onChange={(e) => setForm({ ...form, dailyQty: e.target.value })} />
                </Field>
                <Field label="Milk rate">
                  <input className={inputClass} type="number" min="1" step="0.5" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
                </Field>
                <Field label="Delivery time">
                  <input className={inputClass} type="time" value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Default quantity">
                  <input className={inputClass} type="number" min="0" step="0.1" value={form.dailyQty} onChange={(e) => setForm({ ...form, dailyQty: e.target.value })} />
                </Field>
                <Field label="Default rate">
                  <input className={inputClass} type="number" min="0" step="0.5" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
                </Field>
              </>
            )}
            <Field label="Status">
              <Select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CustomerStatus })}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="stopped">Stopped</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" className={btnPrimary} onClick={() => void saveEdit()} disabled={busy}>
              Save changes
            </button>
            <button type="button" className={btnGhost} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-2 gap-2 border-b border-line p-3 sm:gap-3 sm:p-4 md:grid-cols-5">
          <input className={`${inputClass} col-span-2 md:col-span-1`} placeholder="Search ID, name, mobile" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select className={inputClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="all">All customer types</option>
            <option value="regular">Regular</option>
            <option value="walkin">Daily / Walk-in</option>
          </Select>
          <Select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">Active / Inactive</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select className={inputClass} value={milk} onChange={(e) => setMilk(e.target.value as typeof milk)}>
            <option value="all">All milk types</option>
            <option value="cow">Cow</option>
            <option value="buffalo">Buffalo</option>
            <option value="mixed">Mixed</option>
          </Select>
          <Select className={inputClass} value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)}>
            <option value="all">All payment status</option>
            <option value="pending">Outstanding</option>
            <option value="clear">Clear</option>
          </Select>
        </div>
        <div className="divide-y divide-line/70 md:hidden">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <EmptyState title="No customers match" hint="Change filters or add a customer once." />
          ) : (
            filtered.map((row) => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <Initials name={row.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.name}</p>
                      <CustomerTypeBadge type={row.customerType} />
                      <CustomerStatusBadge status={row.status} />
                    </div>
                    <p className="font-mono text-[11px] text-muted">{row.customerCode} · {row.mobile || "—"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                      <MilkBadge type={row.milkType} />
                      <span>{formatQty(row.subscription?.dailyQty ?? row.defaultQty)}</span>
                      <span>{formatInr(row.subscription?.rate ?? row.defaultRate)}</span>
                    </div>
                    <p className="mt-1 text-[13px] font-semibold">{formatInr(row.outstanding)}</p>
                  </div>
                  <div className="shrink-0">
                    <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-[#f4ead6] hover:text-primary" onClick={() => startEdit(row)} aria-label="Edit">
                      <Pencil size={14} />
                    </button>
                    {row.customerType === "regular" ? (
                      row.status === "paused" ? (
                      <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-emerald-50 hover:text-primary" onClick={() => void resume(row)} aria-label="Resume">
                        <Play size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted hover:bg-amber-50 hover:text-amber-800"
                        onClick={() => {
                          setPauseRow(row);
                          setPauseFrom(todayISO());
                          setResumeDate(addDays(todayISO(), 3));
                        }}
                        aria-label="Pause"
                      >
                        <Pause size={14} />
                      </button>
                    )
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="table-scroll hidden md:block">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Customer ID</th>
                <th className="py-2.5 font-medium">Name</th>
                <th className="py-2.5 font-medium">Mobile</th>
                <th className="py-2.5 font-medium">Customer Type</th>
                <th className="py-2.5 font-medium">Milk Type</th>
                <th className="py-2.5 font-medium">Default Quantity</th>
                <th className="py-2.5 font-medium">Rate</th>
                <th className="py-2.5 font-medium">Outstanding Balance</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            {loading ? (
              <LoadingRows cols={10} />
            ) : (
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState title="No customers match" hint="Change filters or add a regular or daily / walk-in customer." />
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                      <td className="px-4 py-2.5 font-mono text-[12px]">{row.customerCode}</td>
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          <Initials name={row.name} />
                          <span className="font-medium">{row.name}</span>
                        </span>
                      </td>
                      <td>{row.mobile || "—"}</td>
                      <td>
                        <CustomerTypeBadge type={row.customerType} />
                      </td>
                      <td>
                        <MilkBadge type={row.milkType} />
                      </td>
                      <td>{formatQty(row.subscription?.dailyQty ?? row.defaultQty)}</td>
                      <td>{formatInr(row.subscription?.rate ?? row.defaultRate)}</td>
                      <td className="font-semibold">{formatInr(row.outstanding)}</td>
                      <td>
                        <CustomerStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 text-right">
                        <button type="button" className="mr-1 rounded-lg p-1.5 text-muted hover:bg-[#f4ead6] hover:text-primary" onClick={() => startEdit(row)} aria-label="Edit">
                          <Pencil size={14} />
                        </button>
                        {row.customerType === "regular" ? (
                          row.status === "paused" ? (
                            <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-emerald-50 hover:text-primary" onClick={() => void resume(row)} aria-label="Resume">
                              <Play size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-muted hover:bg-amber-50 hover:text-amber-800"
                              onClick={() => {
                                setPauseRow(row);
                                setPauseFrom(todayISO());
                                setResumeDate(addDays(todayISO(), 3));
                              }}
                              aria-label="Pause"
                            >
                              <Pause size={14} />
                            </button>
                          )
                        ) : null}
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
        open={Boolean(pauseRow)}
        title={`Pause ${pauseRow?.name ?? "customer"}`}
        confirmLabel="Pause delivery"
        busy={busy}
        onClose={() => setPauseRow(null)}
        onConfirm={() => void applyPause()}
      >
        <p className="mb-3">Subscription stays the same. Customer will not appear as pending during the pause.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Pause from">
            <input type="date" className={inputClass} value={pauseFrom} onChange={(e) => setPauseFrom(e.target.value)} />
          </Field>
          <Field label="Resume date">
            <input type="date" className={inputClass} value={resumeDate} onChange={(e) => setResumeDate(e.target.value)} />
          </Field>
        </div>
      </ConfirmDialog>
    </div>
  );
}

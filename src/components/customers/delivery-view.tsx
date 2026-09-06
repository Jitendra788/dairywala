"use client";

import { useEffect, useMemo, useState } from "react";
import { customerApi } from "@/lib/customers/client";
import type { DeliveryRow } from "@/lib/customers/types";
import { formatInr, formatQty } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { btnGhost, btnPrimary, Card, Field, Initials, MilkBadge, inputClass, PageHeader } from "@/components/ui";
import { DeliveryStatusBadge, EmptyState, LoadingRows } from "@/components/customers/shared";

type Dialog =
  | { kind: "skip" | "not_delivered"; row: DeliveryRow }
  | { kind: "partial" | "extra"; row: DeliveryRow }
  | { kind: "delivered"; row: DeliveryRow }
  | null;

export function DeliveryView() {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(nextDate = date) {
    setLoading(true);
    try {
      const data = await customerApi<{ deliveries: DeliveryRow[] }>(`/api/deliveries?date=${nextDate}`);
      setRows(data.deliveries);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not load deliveries", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(date);
  }, [date]);

  const pending = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);

  async function act(body: Record<string, unknown>, id: string) {
    setBusy(true);
    try {
      await customerApi(`/api/deliveries/${id}`, { method: "POST", body: JSON.stringify(body) });
      toast.push("Delivery updated");
      setDialog(null);
      setReason("");
      setQty("");
      await load();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Action failed", "err");
    } finally {
      setBusy(false);
    }
  }

  function confirmDialog() {
    if (!dialog) return;
    if (dialog.kind === "delivered") return void act({ action: "delivered" }, dialog.row.id);
    if (dialog.kind === "skip") return void act({ action: "skip", reason }, dialog.row.id);
    if (dialog.kind === "not_delivered") return void act({ action: "not_delivered", reason }, dialog.row.id);
    if (dialog.kind === "partial") return void act({ action: "partial", qty: Number(qty), notes: reason }, dialog.row.id);
    return void act({ action: "extra", extraQty: Number(qty), notes: reason }, dialog.row.id);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        kicker="आज की डिलीवरी"
        title="Daily Milk Delivery"
        hint="Active subscriptions appear automatically. Skip or pause never deletes the customer."
        actions={
          <Field label="Date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        }
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-4">
          <p className="text-[11px] tracking-[0.14em] text-muted uppercase">Today’s list</p>
          <p className="font-display text-3xl">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] tracking-[0.14em] text-muted uppercase">Pending</p>
          <p className="font-display text-3xl">{pending}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] tracking-[0.14em] text-muted uppercase">Date</p>
          <p className="font-display text-2xl">{formatDate(date)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-line/70 md:hidden">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState title="No deliveries today" hint="Add an active customer or resume a paused subscription." />
          ) : (
            rows.map((row) => (
              <div key={row.id} className="space-y-3 px-4 py-3">
                <div className="flex items-start gap-3">
                  <Initials name={row.customer.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.customer.name}</p>
                    <p className="font-mono text-[11px] text-muted">{row.customer.customerCode}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
                      <MilkBadge type={row.customer.milkType} />
                      <span>{formatQty(row.regularQty)}</span>
                      <span className="font-semibold">{formatInr(row.amount)}</span>
                      <DeliveryStatusBadge status={row.status} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" className={`${btnPrimary} px-2 py-2 text-[11px]`} onClick={() => setDialog({ kind: "delivered", row })}>
                    Delivered
                  </button>
                  <button type="button" className={`${btnGhost} px-2 py-2 text-[11px]`} onClick={() => { setReason(""); setDialog({ kind: "skip", row }); }}>
                    Skip today
                  </button>
                  <button type="button" className={`${btnGhost} px-2 py-2 text-[11px]`} onClick={() => { setQty(""); setReason(""); setDialog({ kind: "partial", row }); }}>
                    Partial
                  </button>
                  <button type="button" className={`${btnGhost} px-2 py-2 text-[11px]`} onClick={() => { setQty(""); setReason(""); setDialog({ kind: "extra", row }); }}>
                    Extra milk
                  </button>
                  <button type="button" className={`${btnGhost} col-span-2 px-2 py-2 text-[11px] text-danger`} onClick={() => { setReason(""); setDialog({ kind: "not_delivered", row }); }}>
                    Not delivered
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="table-scroll hidden md:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="py-2.5 font-medium">Milk</th>
                <th className="py-2.5 font-medium">Regular</th>
                <th className="py-2.5 font-medium">Rate</th>
                <th className="py-2.5 font-medium">Amount</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            {loading ? (
              <LoadingRows cols={7} />
            ) : (
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="No deliveries today" hint="Add an active customer or resume a paused subscription." />
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <Initials name={row.customer.name} />
                          <span>
                            <span className="block font-medium">{row.customer.name}</span>
                            <span className="font-mono text-[11px] text-muted">{row.customer.customerCode}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <MilkBadge type={row.customer.milkType} />
                      </td>
                      <td>{formatQty(row.regularQty)}</td>
                      <td>{formatInr(row.rate)}</td>
                      <td className="font-semibold">{formatInr(row.amount)}</td>
                      <td>
                        <DeliveryStatusBadge status={row.status} />
                        {row.skipReason ? <p className="mt-1 text-[11px] text-muted">{row.skipReason}</p> : null}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button type="button" className={`${btnPrimary} px-2.5 py-1 text-[11px]`} onClick={() => setDialog({ kind: "delivered", row })}>
                            Delivered
                          </button>
                          <button type="button" className={`${btnGhost} px-2.5 py-1 text-[11px]`} onClick={() => { setReason(""); setDialog({ kind: "skip", row }); }}>
                            Skip today
                          </button>
                          <button type="button" className={`${btnGhost} px-2.5 py-1 text-[11px]`} onClick={() => { setQty(""); setReason(""); setDialog({ kind: "partial", row }); }}>
                            Partial
                          </button>
                          <button type="button" className={`${btnGhost} px-2.5 py-1 text-[11px]`} onClick={() => { setQty(""); setReason(""); setDialog({ kind: "extra", row }); }}>
                            Extra milk
                          </button>
                          <button type="button" className={`${btnGhost} px-2.5 py-1 text-[11px] text-danger`} onClick={() => { setReason(""); setDialog({ kind: "not_delivered", row }); }}>
                            Not delivered
                          </button>
                        </div>
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
        open={Boolean(dialog)}
        title={
          dialog?.kind === "delivered"
            ? `Mark ${dialog.row.customer.name} delivered?`
            : dialog?.kind === "skip"
              ? "Skip today"
              : dialog?.kind === "partial"
                ? "Partial delivery"
                : dialog?.kind === "extra"
                  ? "Extra milk"
                  : "Not delivered"
        }
        confirmLabel="Save"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      >
        {dialog?.kind === "delivered" ? (
          <p>
            {formatQty(dialog.row.regularQty)} × {formatInr(dialog.row.rate)} will post to the ledger. Subscription stays {formatQty(dialog.row.regularQty)} / day.
          </p>
        ) : null}
        {dialog?.kind === "skip" || dialog?.kind === "not_delivered" ? (
          <Field label={dialog.kind === "skip" ? "Skip reason" : "Reason"}>
            <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Out of town / not home" />
          </Field>
        ) : null}
        {dialog?.kind === "partial" || dialog?.kind === "extra" ? (
          <div className="space-y-3">
            <Field label={dialog.kind === "partial" ? "Delivered quantity (L)" : "Extra quantity (L)"}>
              <input className={inputClass} type="number" min="0.1" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label="Note">
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { addDays, formatDate, formatDateRange, todayISO } from "@/lib/dates";
import { farmerAdvanceSummary } from "@/lib/farmer-ledger";
import { advanceRef, billRef } from "@/lib/ref";
import { formatInr, formatQty, round2 } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { FarmerLedger } from "@/components/farmer-ledger";
import { btnGhost, btnPrimary, Card, Field, confirmAction, inputClass, PageHeader, Select } from "@/components/ui";

type Tab = "bills" | "advances" | "history";

export function PaymentsView() {
  const dairy = useDairy();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("bills");
  const [fromDate, setFromDate] = useState(addDays(todayISO(), -9));
  const [toDate, setToDate] = useState(todayISO());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [farmerId, setFarmerId] = useState(dairy.farmers[0]?.id ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adv, setAdv] = useState({
    farmerId: dairy.farmers[0]?.id ?? "",
    amount: "",
    note: "Cattle feed",
    date: todayISO(),
  });

  useEffect(() => {
    const next = searchParams.get("tab");
    if (next === "advances" || next === "bills" || next === "history") setTab(next);
    const farmer = searchParams.get("farmer");
    if (farmer && dairy.farmers.some((f) => f.id === farmer)) {
      setFarmerId(farmer);
      setAdv((prev) => ({ ...prev, farmerId: farmer }));
    }
  }, [searchParams, dairy.farmers]);

  useEffect(() => {
    if (!farmerId && dairy.farmers[0]) setFarmerId(dairy.farmers[0].id);
    if (!adv.farmerId && dairy.farmers[0]) setAdv((prev) => ({ ...prev, farmerId: dairy.farmers[0].id }));
  }, [dairy.farmers, farmerId, adv.farmerId]);

  const pendingOnly = searchParams.get("status") === "open";
  const bills = dairy.bills.filter((bill) => (pendingOnly ? bill.status === "open" : true));
  const unbilled = useMemo(
    () => dairy.entries.filter((e) => !e.billId && e.date >= fromDate && e.date <= toDate),
    [dairy.entries, fromDate, toDate],
  );
  const advSummary = farmerAdvanceSummary(dairy.advances);
  const openAdvance = dairy.advances.filter((a) => !a.recovered);
  const selectedFarmer = dairy.farmerById(farmerId);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        kicker="बिल व भुगतान"
        title="Billing & payments"
        hint="Bill, advance (open / cleared) aur ek farmer ki complete history yahin."
      />

      <div className="flex flex-wrap gap-2">
        {([
          ["bills", "Bills"],
          ["advances", "Advances"],
          ["history", "Farmer history"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`${tab === key ? btnPrimary : btnGhost} flex-1 sm:flex-none`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-primary">{message}</p> : null}

      {tab === "bills" ? (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Mini label="Unbilled slips" value={String(unbilled.length)} hint={formatQty(unbilled.reduce((s, e) => s + e.qty, 0))} />
            <Mini label="Open bills" value={String(dairy.bills.filter((b) => b.status === "open").length)} hint={formatInr(dairy.bills.filter((b) => b.status === "open").reduce((s, b) => s + b.net, 0))} />
            <Mini label="Advance open" value={formatInr(advSummary.open)} hint={`${advSummary.openCount} not cleared`} warn={advSummary.open > 0} />
            <Mini label="Advance cleared" value={formatInr(advSummary.recovered)} hint="Already cut from bills" />
          </div>
          <Card className="p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="From">
                <input type="date" className={inputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </Field>
              <Field label="To">
                <input type="date" className={inputClass} value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </Field>
              <div className="flex flex-col justify-end text-sm text-muted">
                Period {formatDateRange(fromDate, toDate)}
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className={`${btnPrimary} w-full`}
                  onClick={async () => {
                    const created = await dairy.generateBills(fromDate, toDate);
                    const cut = round2(created.reduce((s, b) => s + b.advance, 0));
                    setMessage(
                      created.length
                        ? `${created.length} bills. Advance cleared ${formatInr(cut)}.`
                        : "Is period mein unbilled milk nahi.",
                    );
                  }}
                >
                  Generate bills
                </button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="table-scroll">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Reference</th>
                    <th className="py-2.5 font-medium">Farmer</th>
                    <th className="py-2.5 font-medium">Period</th>
                    <th className="py-2.5 font-medium">Qty</th>
                    <th className="py-2.5 font-medium">Gross</th>
                    <th className="py-2.5 font-medium">Advance cleared</th>
                    <th className="py-2.5 font-medium">Net</th>
                    <th className="py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted">
                        {pendingOnly ? "Koi pending bill nahi." : "Abhi koi bill nahi."}
                      </td>
                    </tr>
                  ) : (
                    bills.map((bill) => {
                      const farmer = dairy.farmerById(bill.farmerId);
                      return (
                        <tr key={bill.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                          <td className="px-4 py-2.5 font-mono text-xs">
                            <Link href={`/payments/bills/${bill.id}`} className="hover:text-primary">
                              {billRef(bill.id)}
                            </Link>
                          </td>
                          <td className="py-2.5">
                            <Link href={`/payments?tab=history&farmer=${bill.farmerId}`} className="hover:text-primary">
                              {farmer?.code} · {farmer?.name}
                            </Link>
                          </td>
                          <td>{formatDateRange(bill.fromDate, bill.toDate)}</td>
                          <td>{formatQty(bill.qty)}</td>
                          <td>{formatInr(bill.gross)}</td>
                          <td className={bill.advance ? "font-semibold text-amber-800" : "text-muted"}>
                            {bill.advance ? `−${formatInr(bill.advance)}` : "—"}
                          </td>
                          <td className="font-semibold">{formatInr(bill.net)}</td>
                          <td className="capitalize">{bill.status === "paid" ? `Paid ${formatDate(bill.paidAt ?? "")}` : "Unpaid"}</td>
                          <td className="px-4 text-right">
                            {bill.status === "open" ? (
                              <button
                                type="button"
                                className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                                onClick={async () => {
                                  if (!confirmAction("Unpaid bill delete karein? Slips unbilled ho jayengi, advance wapas open.")) return;
                                  try {
                                    await dairy.deleteBill(bill.id);
                                  } catch (e) {
                                    setError(e instanceof Error ? e.message : "Delete fail");
                                  }
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : (
                              <Link href={`/payments?tab=history&farmer=${bill.farmerId}`} className="text-[11px] text-primary">
                                History
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {tab === "advances" ? (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Mini label="Advance given" value={formatInr(advSummary.given)} hint={`${advSummary.count} records`} />
            <Mini label="Still open" value={formatInr(advSummary.open)} hint={`${advSummary.openCount} farmers se recover`} warn={advSummary.open > 0} />
            <Mini label="Cleared on bills" value={formatInr(advSummary.recovered)} hint="Bill generate ke time cut" />
            <Mini label="Open records" value={String(openAdvance.length)} hint="Edit / delete allowed" />
          </div>
          <Card className="p-5">
            <h2 className="mb-1 font-display text-lg">{editingId ? "Update advance" : "Give advance"}</h2>
            <p className="mb-3 text-[13px] text-muted">
              Advance farmer ko cash/feed. Bill generate hone par open advance automatically clear ho jata hai.
            </p>
            <div className="grid gap-3 md:grid-cols-5">
              <Field label="Farmer">
                <Select className={inputClass} value={adv.farmerId} onChange={(e) => setAdv({ ...adv, farmerId: e.target.value })}>
                  {dairy.farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} · {f.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount">
                <input className={inputClass} inputMode="decimal" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} />
              </Field>
              <Field label="Note">
                <input className={inputClass} value={adv.note} onChange={(e) => setAdv({ ...adv, note: e.target.value })} />
              </Field>
              <Field label="Date">
                <input type="date" className={inputClass} value={adv.date} onChange={(e) => setAdv({ ...adv, date: e.target.value })} />
              </Field>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className={`${btnPrimary} w-full`}
                  disabled={!adv.farmerId || !Number(adv.amount)}
                  onClick={async () => {
                    setError("");
                    try {
                      if (editingId) {
                        await dairy.updateAdvance(editingId, {
                          farmerId: adv.farmerId,
                          amount: Number(adv.amount),
                          note: adv.note,
                          date: adv.date,
                        });
                        setEditingId(null);
                        setMessage("Advance update ho gaya.");
                      } else {
                        await dairy.addAdvance({
                          farmerId: adv.farmerId,
                          amount: Number(adv.amount),
                          note: adv.note,
                          date: adv.date,
                        });
                        setMessage("Advance save ho gaya — status Open. Bill generate par clear hoga.");
                      }
                      setFarmerId(adv.farmerId);
                      setAdv({ ...adv, amount: "" });
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Save fail");
                    }
                  }}
                >
                  {editingId ? "Update" : "Add"}
                </button>
              </div>
            </div>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="table-scroll">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Reference</th>
                    <th className="py-2.5 font-medium">Date</th>
                    <th className="py-2.5 font-medium">Farmer</th>
                    <th className="py-2.5 font-medium">Note</th>
                    <th className="py-2.5 font-medium">Amount</th>
                    <th className="py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dairy.advances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted">
                        Koi advance nahi.
                      </td>
                    </tr>
                  ) : (
                    dairy.advances.map((a) => {
                      const farmer = dairy.farmerById(a.farmerId);
                      return (
                        <tr key={a.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                          <td className="px-4 py-2.5 font-mono text-xs">{advanceRef(a.id)}</td>
                          <td>{formatDate(a.date)}</td>
                          <td>
                            <Link href={`/payments?tab=history&farmer=${a.farmerId}`} className="hover:text-primary">
                              {farmer?.code} · {farmer?.name}
                            </Link>
                          </td>
                          <td>{a.note}</td>
                          <td className="font-semibold">{formatInr(a.amount)}</td>
                          <td>
                            {a.recovered ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                Cleared{a.billId ? ` · ${billRef(a.billId)}` : ""}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                Open
                              </span>
                            )}
                          </td>
                          <td className="px-4 text-right">
                            <button
                              type="button"
                              className="mr-1 rounded-lg p-1.5 text-muted hover:bg-[#f4ead6] hover:text-primary disabled:opacity-30"
                              disabled={a.recovered}
                              onClick={() => {
                                setEditingId(a.id);
                                setAdv({
                                  farmerId: a.farmerId,
                                  amount: String(a.amount),
                                  note: a.note,
                                  date: a.date,
                                });
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger disabled:opacity-30"
                              disabled={a.recovered}
                              onClick={async () => {
                                if (!confirmAction("Advance delete karein?")) return;
                                try {
                                  await dairy.deleteAdvance(a.id);
                                  if (editingId === a.id) setEditingId(null);
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : "Delete fail");
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {tab === "history" ? (
        <Card className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Field label="Farmer">
              <Select
                className={inputClass}
                value={farmerId}
                onChange={(e) => setFarmerId(e.target.value)}
              >
                {dairy.farmers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} · {f.name}
                  </option>
                ))}
              </Select>
            </Field>
            {selectedFarmer ? (
              <Link href={`/farmers/${selectedFarmer.id}`} className="text-sm font-semibold text-primary">
                Open farmer profile →
              </Link>
            ) : null}
          </div>
          {selectedFarmer ? (
            <FarmerLedger
              farmerName={selectedFarmer.name}
              entries={dairy.entries.filter((e) => e.farmerId === selectedFarmer.id)}
              advances={dairy.advances.filter((a) => a.farmerId === selectedFarmer.id)}
              bills={dairy.bills.filter((b) => b.farmerId === selectedFarmer.id)}
            />
          ) : (
            <p className="text-sm text-muted">Pehle farmer add karo.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function Mini({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <Card className={`p-3 ${warn ? "border-amber-200 bg-amber-50" : ""}`}>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-[22px] leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </Card>
  );
}

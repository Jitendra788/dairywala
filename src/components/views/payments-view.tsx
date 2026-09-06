"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { addDays, todayISO } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Card, Field, confirmAction, inputClass, PageHeader } from "@/components/ui";

export function PaymentsView() {
  const dairy = useDairy();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"bills" | "advances">("bills");
  const [fromDate, setFromDate] = useState(addDays(todayISO(), -9));
  const [toDate, setToDate] = useState(todayISO());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adv, setAdv] = useState({
    farmerId: dairy.farmers[0]?.id ?? "",
    amount: "",
    note: "Cattle feed",
    date: todayISO(),
  });

  useEffect(() => {
    const next = searchParams.get("tab");
    if (next === "advances") setTab("advances");
    if (next === "bills" || next === "history") setTab("bills");
  }, [searchParams]);

  const pendingOnly = searchParams.get("status") === "open";

  const unbilled = useMemo(
    () => dairy.entries.filter((e) => !e.billId && e.date >= fromDate && e.date <= toDate),
    [dairy.entries, fromDate, toDate],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        kicker="बिल व भुगतान"
        title="Billing & payments"
        hint="Bills generate, advance add/update/delete, unpaid bill delete."
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${tab === "bills" ? btnPrimary : btnGhost} flex-1 sm:flex-none`} onClick={() => setTab("bills")}>
          Bills
        </button>
        <button type="button" className={`${tab === "advances" ? btnPrimary : btnGhost} flex-1 sm:flex-none`} onClick={() => setTab("advances")}>
          Advances
        </button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {tab === "bills" ? (
        <>
          <Card className="p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="From">
                <input type="date" className={inputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </Field>
              <Field label="To">
                <input type="date" className={inputClass} value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </Field>
              <div className="flex flex-col justify-end text-sm text-muted">
                Unbilled: {unbilled.length} · {formatQty(unbilled.reduce((s, e) => s + e.qty, 0))}
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className={`${btnPrimary} w-full`}
                  onClick={() => {
                    const created = dairy.generateBills(fromDate, toDate);
                    setMessage(created.length ? `${created.length} bills ban gaye.` : "Is period mein unbilled milk nahi.");
                  }}
                >
                  Generate bills
                </button>
              </div>
            </div>
            {message ? <p className="mt-3 text-sm text-primary">{message}</p> : null}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="table-scroll">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Farmer</th>
                  <th className="py-2.5 font-medium">Period</th>
                  <th className="py-2.5 font-medium">Qty</th>
                  <th className="py-2.5 font-medium">Net</th>
                  <th className="py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {dairy.bills.filter((bill) => (pendingOnly ? bill.status === "open" : true)).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      {pendingOnly ? "Koi pending bill nahi." : "Abhi koi bill nahi."}
                    </td>
                  </tr>
                ) : (
                  dairy.bills.filter((bill) => (pendingOnly ? bill.status === "open" : true)).map((bill) => {
                    const farmer = dairy.farmerById(bill.farmerId);
                    return (
                      <tr key={bill.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                        <td className="px-4 py-2.5">
                          <Link href={`/payments/bills/${bill.id}`} className="hover:text-primary">
                            {farmer?.code} · {farmer?.name}
                          </Link>
                        </td>
                        <td>
                          {bill.fromDate} → {bill.toDate}
                        </td>
                        <td>{formatQty(bill.qty)}</td>
                        <td className="font-semibold">{formatInr(bill.net)}</td>
                        <td className="capitalize">{bill.status}</td>
                        <td className="px-4 text-right">
                          {bill.status === "open" ? (
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                              onClick={() => {
                                if (!confirmAction("Unpaid bill delete karein? Slips unbilled ho jayengi.")) return;
                                try {
                                  dairy.deleteBill(bill.id);
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : "Delete fail");
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted">Paid</span>
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
      ) : (
        <>
          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg">{editingId ? "Update advance" : "Give advance"}</h2>
            <div className="grid gap-3 md:grid-cols-5">
              <Field label="Farmer">
                <select className={inputClass} value={adv.farmerId} onChange={(e) => setAdv({ ...adv, farmerId: e.target.value })}>
                  {dairy.farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} · {f.name}
                    </option>
                  ))}
                </select>
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
                  onClick={() => {
                    setError("");
                    try {
                      if (editingId) {
                        dairy.updateAdvance(editingId, {
                          farmerId: adv.farmerId,
                          amount: Number(adv.amount),
                          note: adv.note,
                          date: adv.date,
                        });
                        setEditingId(null);
                        setMessage("Advance update ho gaya.");
                      } else {
                        dairy.addAdvance({
                          farmerId: adv.farmerId,
                          amount: Number(adv.amount),
                          note: adv.note,
                          date: adv.date,
                        });
                        setMessage("Advance save ho gaya.");
                      }
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="py-2.5 font-medium">Farmer</th>
                  <th className="py-2.5 font-medium">Note</th>
                  <th className="py-2.5 font-medium">Amount</th>
                  <th className="py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {dairy.advances.map((a) => {
                  const farmer = dairy.farmerById(a.farmerId);
                  return (
                    <tr key={a.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                      <td className="px-4 py-2.5">{a.date}</td>
                      <td>
                        {farmer?.code} · {farmer?.name}
                      </td>
                      <td>{a.note}</td>
                      <td className="font-semibold">{formatInr(a.amount)}</td>
                      <td>{a.recovered ? "Recovered" : "Open"}</td>
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
                          onClick={() => {
                            if (!confirmAction("Advance delete karein?")) return;
                            try {
                              dairy.deleteAdvance(a.id);
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
                })}
              </tbody>
            </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

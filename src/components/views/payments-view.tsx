"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, todayISO } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Card, Field, inputClass, PageHeader } from "@/components/ui";

export function PaymentsView() {
  const dairy = useDairy();
  const [tab, setTab] = useState<"bills" | "advances">("bills");
  const [fromDate, setFromDate] = useState(addDays(todayISO(), -9));
  const [toDate, setToDate] = useState(todayISO());
  const [message, setMessage] = useState("");
  const [adv, setAdv] = useState({
    farmerId: dairy.farmers[0]?.id ?? "",
    amount: "",
    note: "Cattle feed",
    date: todayISO(),
  });

  const unbilled = useMemo(
    () => dairy.entries.filter((e) => !e.billId && e.date >= fromDate && e.date <= toDate),
    [dairy.entries, fromDate, toDate],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="बिल व भुगतान"
        title="Billing & payments"
        hint="10/15/30 din ke cycle jaisa. Collection se bill banta hai, advance kat-ta hai, phir payout."
      />

      <div className="flex gap-2">
        <button
          type="button"
          className={tab === "bills" ? btnPrimary : btnGhost}
          onClick={() => setTab("bills")}
        >
          Bills
        </button>
        <button
          type="button"
          className={tab === "advances" ? btnPrimary : btnGhost}
          onClick={() => setTab("advances")}
        >
          Advances
        </button>
      </div>

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
                Unbilled slips: {unbilled.length} · {formatQty(unbilled.reduce((s, e) => s + e.qty, 0))}
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className={`${btnPrimary} w-full`}
                  onClick={() => {
                    const created = dairy.generateBills(fromDate, toDate);
                    setMessage(
                      created.length
                        ? `${created.length} farmer bills ban gaye.`
                        : "Is period mein koi unbilled milk nahi.",
                    );
                  }}
                >
                  Generate bills
                </button>
              </div>
            </div>
            {message ? <p className="mt-3 text-sm text-primary">{message}</p> : null}
          </Card>

          <Card className="p-5">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="pb-2 font-medium">Farmer</th>
                  <th className="pb-2 font-medium">Period</th>
                  <th className="pb-2 font-medium">Qty</th>
                  <th className="pb-2 font-medium">Gross</th>
                  <th className="pb-2 font-medium">Advance</th>
                  <th className="pb-2 font-medium">Net</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dairy.bills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted">
                      Abhi koi bill nahi. Period choose karke generate karo.
                    </td>
                  </tr>
                ) : (
                  dairy.bills.map((bill) => {
                    const farmer = dairy.farmerById(bill.farmerId);
                    return (
                      <tr key={bill.id} className="border-t border-line">
                        <td className="py-2.5">
                          <Link href={`/payments/bills/${bill.id}`} className="hover:text-primary">
                            {farmer?.code} · {farmer?.name}
                          </Link>
                        </td>
                        <td>
                          {bill.fromDate} → {bill.toDate}
                        </td>
                        <td>{formatQty(bill.qty)}</td>
                        <td>{formatInr(bill.gross)}</td>
                        <td>{formatInr(bill.advance)}</td>
                        <td className="font-medium">{formatInr(bill.net)}</td>
                        <td className="capitalize">{bill.status}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <>
          <Card className="p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Farmer">
                <select
                  className={inputClass}
                  value={adv.farmerId}
                  onChange={(e) => setAdv({ ...adv, farmerId: e.target.value })}
                >
                  {dairy.farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} · {f.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={adv.amount}
                  onChange={(e) => setAdv({ ...adv, amount: e.target.value })}
                />
              </Field>
              <Field label="Note">
                <input className={inputClass} value={adv.note} onChange={(e) => setAdv({ ...adv, note: e.target.value })} />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  className={`${btnPrimary} w-full`}
                  disabled={!adv.farmerId || !Number(adv.amount)}
                  onClick={() => {
                    dairy.addAdvance({
                      farmerId: adv.farmerId,
                      amount: Number(adv.amount),
                      note: adv.note,
                      date: adv.date,
                    });
                    setAdv({ ...adv, amount: "" });
                    setMessage("Advance save ho gaya. Next bill se recover hoga.");
                    setTab("advances");
                  }}
                >
                  Give advance
                </button>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Farmer</th>
                  <th className="pb-2 font-medium">Note</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dairy.advances.map((a) => {
                  const farmer = dairy.farmerById(a.farmerId);
                  return (
                    <tr key={a.id} className="border-t border-line">
                      <td className="py-2.5">{a.date}</td>
                      <td>
                        {farmer?.code} · {farmer?.name}
                      </td>
                      <td>{a.note}</td>
                      <td>{formatInr(a.amount)}</td>
                      <td>{a.recovered ? "Recovered" : "Open"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

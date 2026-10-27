"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatDate, formatDateRange, todayISO } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import { farmerLabel } from "@/lib/farmer-label";
import { billPaidAmount, billRemainingOf } from "@/lib/farmer-ledger";
import { billRef, slipRef } from "@/lib/ref";
import { useDairy } from "@/hooks/use-dairy";
import { useI18n } from "@/hooks/use-i18n";
import { btnDanger, btnPrimary, Card, confirmAction, Field } from "@/components/ui";
import { DairyLetterhead } from "@/components/dairy-brand";

export function BillView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const dairy = useDairy();
  const { t } = useI18n();
  const bill = dairy.bills.find((b) => b.id === id);
  const farmer = bill ? dairy.farmerById(bill.farmerId) : undefined;
  const lines = dairy.entries.filter((e) => e.billId === id);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!bill || !farmer) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        {t("billMissing")} <Link href="/payments" className="text-primary">{t("backPayments")}</Link>
      </Card>
    );
  }

  const paidAmt = billPaidAmount(bill);
  const remain = billRemainingOf(bill);
  const giveNow = Number(amount) || 0;

  async function recordPay() {
    if (giveNow <= 0 || remain <= 0) return;
    setBusy(true);
    setError("");
    try {
      await dairy.addFarmerPayment({
        farmerId: bill.farmerId,
        amount: Math.min(giveNow, remain),
        date: todayISO(),
        note: `Bill ${billRef(bill.id)}`,
        billId: bill.id,
      });
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboardClosed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap gap-3 print:hidden">
        <button type="button" className={btnPrimary} onClick={() => window.print()}>
          {t("printBill")}
        </button>
        {paidAmt <= 0 ? (
          <button
            type="button"
            className={btnDanger}
            onClick={async () => {
              if (!confirmAction(t("deleteBill"))) return;
              await dairy.deleteBill(bill.id);
              router.push("/payments?tab=bills");
            }}
          >
            {t("deleteBill")}
          </button>
        ) : null}
        <Link href="/payments?tab=bills" className="self-center text-sm text-primary">
          {t("allBills")}
        </Link>
      </div>
      {error ? <p className="text-sm text-danger print:hidden">{error}</p> : null}

      {remain > 0 ? (
        <Card className="p-4 print:hidden sm:p-5">
          <h2 className="mb-3 font-display text-lg">{t("recordPayment")}</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#f7f1e6] px-4 py-3">
              <p className="text-[11px] text-muted">{t("alreadyPaid")}</p>
              <p className="mt-1 font-display text-[24px] leading-none tabular-nums">{formatInr(paidAmt)}</p>
            </div>
            <div className="rounded-2xl bg-[#f7f1e6] px-4 py-3">
              <p className="text-[11px] text-muted">{t("remainingDue")}</p>
              <p className="mt-1 font-display text-[24px] leading-none tabular-nums">{formatInr(remain)}</p>
            </div>
          </div>
          <div className="mt-3">
            <Field label={t("youGiving")}>
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-[#fbf7ef] px-4 py-3 focus-within:border-primary focus-within:bg-white">
                <span className="text-lg font-semibold text-muted">₹</span>
                <input
                  className="money-input w-full min-w-0 bg-transparent font-display text-[34px] leading-none outline-none"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </Field>
          </div>
          <button
            type="button"
            className={`${btnPrimary} mt-4 w-full sm:w-auto`}
            disabled={giveNow <= 0 || busy}
            onClick={() => void recordPay()}
          >
            {busy ? t("paying") : t("recordPayment")}
          </button>
        </Card>
      ) : null}

      <Card className="print-slip p-4 sm:p-6">
        <DairyLetterhead settings={dairy.settings} kicker="Farmer bill" />
        <div className="mt-4 grid gap-1 text-sm">
          <p>
            <span className="text-muted">Reference · </span>
            {billRef(bill.id)}
          </p>
          <p>
            <span className="text-muted">Farmer · </span>
            {farmerLabel(farmer)}
          </p>
          <p>
            <span className="text-muted">Period · </span>
            {formatDateRange(bill.fromDate, bill.toDate)}
          </p>
          <p>
            <span className="text-muted">Payout · </span>
            {farmer.upi || `${farmer.bankName} ${farmer.accountNo}` || "Cash"}
          </p>
        </div>

        <div className="mt-5 space-y-2 md:hidden">
          {lines.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl bg-[#fbf8f1] px-3 py-2.5 text-[13px]">
              <div className="min-w-0">
                <p className="font-medium capitalize">{formatDate(e.date)} · {e.shift}</p>
                <p className="truncate text-[11px] text-muted">{slipRef(e.id)} · FAT {e.fat} · SNF {e.snf}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums">{formatInr(e.amount)}</p>
                <p className="text-[11px] text-muted">{e.qty} L</p>
              </div>
            </div>
          ))}
        </div>
        <div className="table-scroll mt-5 hidden md:block">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-[11px] uppercase text-muted">
            <tr>
              <th className="pb-2">Ref</th>
              <th className="pb-2">Date</th>
              <th className="pb-2">Shift</th>
              <th className="pb-2">L</th>
              <th className="pb-2">FAT</th>
              <th className="pb-2">SNF</th>
              <th className="pb-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="py-1.5 font-mono text-[11px]">{slipRef(e.id)}</td>
                <td className="py-1.5">{formatDate(e.date)}</td>
                <td>{e.shift}</td>
                <td>{e.qty}</td>
                <td>{e.fat}</td>
                <td>{e.snf}</td>
                <td>{formatInr(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
          <Line label="Total qty" value={formatQty(bill.qty)} />
          <Line label="Avg FAT / SNF" value={`${bill.avgFat} / ${bill.avgSnf}`} />
          <Line label="Gross" value={formatInr(bill.gross)} />
          <Line label="Advance recovered" value={formatInr(bill.advance)} />
          <Line label="Net payable" value={formatInr(bill.net)} strong />
          <Line label="Already paid" value={formatInr(paidAmt)} />
          <Line label="Remaining" value={formatInr(remain)} strong />
          <Line
            label="Status"
            value={remain <= 0 ? `Paid ${formatDate(bill.paidAt ?? "")}` : paidAmt > 0 ? "Partial" : "Open"}
          />
        </div>
      </Card>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={strong ? "text-lg font-semibold" : ""}>{value}</span>
    </div>
  );
}

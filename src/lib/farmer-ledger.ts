import { formatDate, formatDateRange } from "@/lib/dates";
import { formatInr, round2 } from "@/lib/money";
import { advanceRef, billRef, paymentRef, slipRef } from "@/lib/ref";
import type { Advance, Bill, CollectionEntry, FarmerPayment } from "@/lib/types";

export type FarmerLedgerKind = "slip" | "advance" | "bill" | "payment";

export type FarmerLedgerLine = {
  id: string;
  date: string;
  at: string;
  sort: string;
  kind: FarmerLedgerKind;
  ref: string;
  title: string;
  note: string;
  credit: number;
  debit: number;
  href?: string;
  status: string;
};

export function billPaidAmount(bill: Bill) {
  return round2(bill.paidAmount || (bill.status === "paid" ? bill.net : 0));
}

export function billRemainingOf(bill: Bill) {
  return round2(bill.remaining ?? Math.max(0, bill.net - billPaidAmount(bill)));
}

export function farmerPendingDue(farmerId: string, bills: Bill[], entries: CollectionEntry[]) {
  const billsDue = bills.filter((bill) => bill.farmerId === farmerId).reduce((sum, bill) => sum + billRemainingOf(bill), 0);
  const unbilled = entries.filter((entry) => entry.farmerId === farmerId && !entry.billId).reduce((sum, entry) => sum + entry.amount, 0);
  return round2(billsDue + unbilled);
}

export function farmerAdvanceSummary(advances: Advance[]) {
  const given = round2(advances.reduce((s, a) => s + a.amount, 0));
  const recovered = round2(advances.filter((a) => a.recovered).reduce((s, a) => s + a.amount, 0));
  return {
    given,
    recovered,
    open: round2(given - recovered),
    count: advances.length,
    openCount: advances.filter((a) => !a.recovered).length,
  };
}

export function farmerMoneySummary(
  entries: CollectionEntry[],
  advances: Advance[],
  bills: Bill[],
  payments: FarmerPayment[] = [],
) {
  const milk = round2(entries.reduce((s, e) => s + e.amount, 0));
  const qty = round2(entries.reduce((s, e) => s + e.qty, 0));
  const paidFromPays = round2(payments.reduce((s, p) => s + p.amount, 0));
  const paidFromBills = round2(bills.reduce((s, b) => s + (b.paidAmount || (b.status === "paid" ? b.net : 0)), 0));
  const paid = round2(Math.max(paidFromPays, paidFromBills));
  const pendingBills = round2(bills.filter((b) => b.status !== "paid").reduce((s, b) => s + (b.remaining ?? b.net), 0));
  const adv = farmerAdvanceSummary(advances);
  return {
    milk,
    qty,
    slips: entries.length,
    paid,
    pendingBills,
    payable: round2(milk - adv.given - paid),
    ...adv,
  };
}

export function farmerSettlement(
  entries: CollectionEntry[],
  advances: Advance[],
  bills: Bill[],
  payments: FarmerPayment[] = [],
) {
  const summary = farmerMoneySummary(entries, advances, bills, payments);
  const toPay = round2(Math.max(0, summary.payable));
  const farmerOwes = round2(Math.max(0, -summary.payable));
  return { ...summary, toPay, farmerOwes, cleared: toPay === 0 };
}

export function buildFarmerLedger(
  entries: CollectionEntry[],
  advances: Advance[],
  bills: Bill[],
  payments: FarmerPayment[] = [],
): FarmerLedgerLine[] {
  const lines: FarmerLedgerLine[] = [];

  for (const entry of entries) {
    lines.push({
      id: entry.id,
      date: entry.date,
      at: entry.createdAt || entry.date,
      sort: `${entry.createdAt || `${entry.date}T00:00:00`}-slip`,
      kind: "slip",
      ref: slipRef(entry.id),
      title: `Milk · ${entry.shift === "morning" ? "Subah" : "Shaam"} · ${entry.qty} L`,
      note: `FAT ${entry.fat} / SNF ${entry.snf}${entry.billId ? ` · billed ${billRef(entry.billId)}` : " · unbilled"}`,
      credit: entry.amount,
      debit: 0,
      href: `/collection/${entry.id}`,
      status: entry.billId ? "Billed" : "Unbilled",
    });
  }

  for (const advance of advances) {
    lines.push({
      id: advance.id,
      date: advance.date,
      at: advance.createdAt || advance.date,
      sort: `${advance.createdAt || `${advance.date}T12:00:00`}-advance`,
      kind: "advance",
      ref: advanceRef(advance.id),
      title: "Advance given",
      note: `${advance.note || "Advance"}${advance.recovered && advance.billId ? ` · cleared on ${billRef(advance.billId)}` : ""}`,
      credit: 0,
      debit: advance.amount,
      href: `/payments?tab=advances`,
      status: advance.recovered ? "Cleared" : "Open",
    });
  }

  for (const bill of bills) {
    const paidAmt = billPaidAmount(bill);
    const remain = billRemainingOf(bill);
    const paid = remain <= 0;
    const partial = !paid && paidAmt > 0;
    lines.push({
      id: bill.id,
      date: (paid && bill.paidAt ? bill.paidAt.slice(0, 10) : bill.toDate) || bill.toDate,
      at: (paid && bill.paidAt ? bill.paidAt : bill.createdAt) || bill.toDate,
      sort: `${paid && bill.paidAt ? bill.paidAt : bill.createdAt || `${bill.toDate}T18:00:00`}-bill`,
      kind: "bill",
      ref: billRef(bill.id),
      title: paid ? "Bill paid" : partial ? "Bill partial" : "Bill generated",
      note: `${formatDateRange(bill.fromDate, bill.toDate)} · net ${formatInr(bill.net)} · paid ${formatInr(paidAmt)} · remaining ${formatInr(remain)}`,
      credit: 0,
      debit: 0,
      href: `/payments/bills/${bill.id}`,
      status: paid ? `Paid ${formatDate(bill.paidAt ?? "")}` : partial ? `Remaining ${formatInr(remain)}` : "Unpaid",
    });
  }

  for (const payment of payments) {
    lines.push({
      id: payment.id,
      date: payment.date,
      at: payment.createdAt || payment.date,
      sort: `${payment.createdAt || `${payment.date}T16:00:00`}-payment`,
      kind: "payment",
      ref: paymentRef(payment.id, payment.date),
      title: "Payment given",
      note: payment.note || "Farmer payment",
      credit: 0,
      debit: payment.amount,
      href: "/payments?tab=bills",
      status: "Paid",
    });
  }

  return lines.sort((a, b) => a.sort.localeCompare(b.sort) || a.ref.localeCompare(b.ref));
}

export function withRunningBalance(lines: FarmerLedgerLine[]) {
  let balance = 0;
  return lines.map((line) => {
    balance = round2(balance + line.credit - line.debit);
    return { ...line, balance };
  });
}

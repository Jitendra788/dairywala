import { formatDate, formatDateRange } from "@/lib/dates";
import { formatInr, round2 } from "@/lib/money";
import { advanceRef, billRef, slipRef } from "@/lib/ref";
import type { Advance, Bill, CollectionEntry } from "@/lib/types";

export type FarmerLedgerKind = "slip" | "advance" | "bill";

export type FarmerLedgerLine = {
  id: string;
  date: string;
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
) {
  const milk = round2(entries.reduce((s, e) => s + e.amount, 0));
  const qty = round2(entries.reduce((s, e) => s + e.qty, 0));
  const paid = round2(bills.filter((b) => b.status === "paid").reduce((s, b) => s + b.net, 0));
  const pendingBills = round2(bills.filter((b) => b.status === "open").reduce((s, b) => s + b.net, 0));
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

export function buildFarmerLedger(
  entries: CollectionEntry[],
  advances: Advance[],
  bills: Bill[],
): FarmerLedgerLine[] {
  const lines: FarmerLedgerLine[] = [];

  for (const entry of entries) {
    lines.push({
      id: entry.id,
      date: entry.date,
      sort: `${entry.date}T${entry.createdAt || "00:00:00"}-slip`,
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
      sort: `${advance.date}T12:00:00-advance`,
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
    const paid = bill.status === "paid";
    lines.push({
      id: bill.id,
      date: (paid && bill.paidAt ? bill.paidAt.slice(0, 10) : bill.toDate) || bill.toDate,
      sort: `${paid && bill.paidAt ? bill.paidAt : `${bill.toDate}T18:00:00`}-bill`,
      kind: "bill",
      ref: billRef(bill.id),
      title: paid ? "Bill paid" : "Bill generated",
      note: `${formatDateRange(bill.fromDate, bill.toDate)} · gross ${formatInr(bill.gross)}${bill.advance ? ` · advance cleared ${formatInr(bill.advance)}` : ""}`,
      credit: 0,
      debit: paid ? bill.net : 0,
      href: `/payments/bills/${bill.id}`,
      status: paid ? `Paid ${formatDate(bill.paidAt ?? "")}` : "Unpaid",
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

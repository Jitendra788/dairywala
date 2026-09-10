"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatInr, formatQty } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnDanger, btnPrimary, Card, confirmAction } from "@/components/ui";
import { DairyLetterhead } from "@/components/dairy-brand";

export function BillView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const dairy = useDairy();
  const bill = dairy.bills.find((b) => b.id === id);
  const farmer = bill ? dairy.farmerById(bill.farmerId) : undefined;
  const lines = dairy.entries.filter((e) => e.billId === id);

  if (!bill || !farmer) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        Bill nahi mili. <Link href="/payments" className="text-primary">Payments</Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap gap-3 print:hidden">
        <button type="button" className={btnPrimary} onClick={() => window.print()}>
          Print bill
        </button>
        {bill.status === "open" ? (
          <>
            <button type="button" className={btnPrimary} onClick={() => void dairy.markBillPaid(bill.id)}>
              Mark paid
            </button>
            <button
              type="button"
              className={btnDanger}
              onClick={async () => {
                if (!confirmAction("Bill delete karein?")) return;
                await dairy.deleteBill(bill.id);
                router.push("/payments");
              }}
            >
              Delete bill
            </button>
          </>
        ) : null}
        <Link href="/payments" className="self-center text-sm text-primary">
          All bills
        </Link>
      </div>

      <Card className="print-slip p-6">
        <DairyLetterhead settings={dairy.settings} kicker="Farmer bill" />
        <div className="mt-4 grid gap-1 text-sm">
          <p>
            <span className="text-muted">Farmer · </span>
            {farmer.code} {farmer.name}
          </p>
          <p>
            <span className="text-muted">Period · </span>
            {bill.fromDate} to {bill.toDate}
          </p>
          <p>
            <span className="text-muted">Payout · </span>
            {farmer.upi || `${farmer.bankName} ${farmer.accountNo}` || "Cash"}
          </p>
        </div>

        <div className="table-scroll mt-5">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-[11px] uppercase text-muted">
            <tr>
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
                <td className="py-1.5">{e.date}</td>
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
          <Line label="Status" value={bill.status === "paid" ? `Paid ${bill.paidAt?.slice(0, 10)}` : "Open"} />
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

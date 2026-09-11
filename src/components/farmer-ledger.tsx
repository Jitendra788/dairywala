"use client";

import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import {
  buildFarmerLedger,
  farmerMoneySummary,
  withRunningBalance,
} from "@/lib/farmer-ledger";
import { Card } from "@/components/ui";
import type { Advance, Bill, CollectionEntry } from "@/lib/types";

export function FarmerLedger({
  farmerName,
  entries,
  advances,
  bills,
}: {
  farmerName?: string;
  entries: CollectionEntry[];
  advances: Advance[];
  bills: Bill[];
}) {
  const summary = farmerMoneySummary(entries, advances, bills);
  const rows = withRunningBalance(buildFarmerLedger(entries, advances, bills));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        <Mini label="Milk" value={formatInr(summary.milk)} hint={`${summary.slips} slips · ${formatQty(summary.qty)}`} />
        <Mini label="Advance given" value={formatInr(summary.given)} hint={`${summary.count} records`} />
        <Mini label="Advance open" value={formatInr(summary.open)} hint={`${summary.openCount} not cleared`} warn={summary.open > 0} />
        <Mini label="Advance cleared" value={formatInr(summary.recovered)} hint="Cut from bills" />
        <Mini label="Paid to farmer" value={formatInr(summary.paid)} hint={summary.pendingBills ? `Unpaid ${formatInr(summary.pendingBills)}` : "All paid"} />
        <Mini label="Payable now" value={formatInr(summary.payable)} hint={farmerName || "Remaining"} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-display text-lg">Complete history</h2>
          <p className="text-[12px] text-muted">Slip, advance aur bill — date wise, running balance ke saath.</p>
        </div>
        <div className="divide-y divide-line/70 md:hidden">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Is farmer ki abhi koi history nahi.</p>
          ) : (
            rows.map((row) => (
              <Link key={row.id} href={row.href || "#"} className="block px-4 py-3 hover:bg-[#faf6ee]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{row.title}</p>
                    <p className="font-mono text-[11px] text-muted">{row.ref}</p>
                    <p className="text-[12px] text-muted">{formatDate(row.date)} · {row.status}</p>
                    <p className="text-[12px] text-muted">{row.note}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {row.credit ? <p className="text-[13px] font-semibold text-primary">+{formatInr(row.credit)}</p> : null}
                    {row.debit ? <p className="text-[13px] font-semibold text-danger">−{formatInr(row.debit)}</p> : null}
                    <p className="text-[11px] text-muted">Bal {formatInr(row.balance)}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
        <div className="table-scroll hidden md:block">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="py-2.5 font-medium">Reference</th>
                <th className="py-2.5 font-medium">Particular</th>
                <th className="py-2.5 font-medium">Status</th>
                <th className="py-2.5 font-medium text-right">Credit</th>
                <th className="py-2.5 font-medium text-right">Debit</th>
                <th className="px-4 py-2.5 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Is farmer ki abhi koi history nahi.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                    <td className="px-4 py-2.5">{formatDate(row.date)}</td>
                    <td className="font-mono text-xs">
                      {row.href ? (
                        <Link href={row.href} className="hover:text-primary">
                          {row.ref}
                        </Link>
                      ) : (
                        row.ref
                      )}
                    </td>
                    <td>
                      <span className="block font-medium">{row.title}</span>
                      <span className="text-[11px] text-muted">{row.note}</span>
                    </td>
                    <td>
                      <StatusPill kind={row.kind} status={row.status} />
                    </td>
                    <td className="text-right text-primary">{row.credit ? formatInr(row.credit) : "—"}</td>
                    <td className="text-right text-danger">{row.debit ? formatInr(row.debit) : "—"}</td>
                    <td className="px-4 text-right font-semibold">{formatInr(row.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Mini({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <Card className={`p-3 ${warn ? "border-amber-200 bg-amber-50" : ""}`}>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-[22px] leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </Card>
  );
}

function StatusPill({ kind, status }: { kind: string; status: string }) {
  const color =
    status === "Cleared" || status.startsWith("Paid") || status === "Billed"
      ? "bg-emerald-50 text-primary"
      : status === "Open" || status === "Unpaid" || status === "Unbilled"
        ? "bg-amber-50 text-amber-800"
        : "bg-[#f4ead6] text-muted";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {kind === "advance" && status === "Open" ? "Advance open" : status}
    </span>
  );
}

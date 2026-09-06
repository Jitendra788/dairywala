"use client";

import Link from "next/link";
import { ArrowRight, Droplets, FileSpreadsheet, Wallet } from "lucide-react";
import { formatInr, formatQty } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnPrimary, Card } from "@/components/ui";

export function DashboardView() {
  const dairy = useDairy();
  const today = dairy.todayStats();
  const recent = dairy.entries.slice(0, 6);

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">
            {dairy.settings.centerName}
          </p>
          <h1 className="font-display text-3xl tracking-tight">{dairy.settings.dairyName}</h1>
        </div>
        <Link href="/collection" className={btnPrimary}>
          Start collection
          <ArrowRight size={15} className="ml-1.5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Aaj ka doodh" value={formatQty(today.qty)} hint={`${today.slips} slips · ${today.farmers} farmers`} />
        <Stat label="Avg FAT / SNF" value={`${today.avgFat} / ${today.avgSnf}`} hint={`M ${today.morning} L · E ${today.evening} L`} />
        <Stat label="Aaj ki value" value={formatInr(today.amount)} hint="Rate chart se" />
        <Stat label="Farmer payable" value={formatInr(dairy.payableTotal())} hint="Milk − advance − paid" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { href: "/collection", title: "Collect", text: "Code, qty, FAT/SNF, slip", icon: Droplets },
          { href: "/payments", title: "Bill & pay", text: "Cycle, advance, payout", icon: Wallet },
          { href: "/reports", title: "Reports", text: "Milk aur farmer statement", icon: FileSpreadsheet },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 shadow-sm hover:border-primary/35"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-primary">
              <item.icon size={16} />
            </span>
            <span>
              <span className="block font-display text-lg leading-none">{item.title}</span>
              <span className="text-xs text-muted">{item.text}</span>
            </span>
          </Link>
        ))}
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-lg">Recent slips</h2>
          <Link href="/collection" className="text-xs font-medium text-primary">
            Open desk
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-card text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Farmer</th>
                <th className="py-2 font-medium">When</th>
                <th className="py-2 font-medium">L</th>
                <th className="py-2 font-medium">FAT/SNF</th>
                <th className="px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => {
                const f = dairy.farmerById(e.farmerId);
                return (
                  <tr key={e.id} className="border-t border-line/80">
                    <td className="px-4 py-2">
                      <Link href={`/collection/${e.id}`} className="hover:text-primary">
                        {f?.code} · {f?.name}
                      </Link>
                    </td>
                    <td>
                      {e.date} {e.shift}
                    </td>
                    <td>{e.qty}</td>
                    <td>
                      {e.fat} / {e.snf}
                    </td>
                    <td className="px-4">{formatInr(e.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-3.5 shadow-sm">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
    </Card>
  );
}

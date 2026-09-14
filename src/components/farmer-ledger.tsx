"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, Droplets, Receipt } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import {
  buildFarmerLedger,
  farmerMoneySummary,
  withRunningBalance,
  type FarmerLedgerKind,
} from "@/lib/farmer-ledger";
import { useI18n } from "@/hooks/use-i18n";
import { btnGhost, btnInverse, btnPrimary, Card } from "@/components/ui";
import type { Advance, Bill, CollectionEntry } from "@/lib/types";

type Filter = "all" | FarmerLedgerKind;

const PAGE_SIZE = 10;

export function FarmerLedger({
  farmerName,
  farmerId,
  entries,
  advances,
  bills,
}: {
  farmerName?: string;
  farmerId?: string;
  entries: CollectionEntry[];
  advances: Advance[];
  bills: Bill[];
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const summary = farmerMoneySummary(entries, advances, bills);
  const rows = useMemo(
    () => [...withRunningBalance(buildFarmerLedger(entries, advances, bills))].reverse(),
    [entries, advances, bills],
  );
  const shown = filter === "all" ? rows : rows.filter((row) => row.kind === filter);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const paged = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const weOwe = summary.payable > 0 ? summary.payable : 0;
  const theyOwe = summary.payable < 0 ? Math.abs(summary.payable) : 0;

  useEffect(() => {
    setPage(1);
  }, [filter, farmerId]);

  return (
    <div className="space-y-4 [word-spacing:normal]">
      <section className="relative overflow-hidden rounded-[28px] bg-primary px-4 py-4 text-white shadow-[0_16px_40px_rgba(24,122,72,0.28)] sm:px-5 sm:py-5">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-16 -bottom-12 h-32 w-32 rounded-full bg-gold/20" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.16em] text-white/70 uppercase">{t("farmerHistory")}</p>
            <h2 className="mt-1 truncate font-display text-[24px] leading-tight sm:text-[30px]">{farmerName || t("farmer")}</h2>
            <p className="mt-2 text-[13px] text-white/80">
              {t("ledgerFormula", {
                milk: formatInr(summary.milk),
                adv: formatInr(summary.given),
                paid: formatInr(summary.paid),
              })}
            </p>
          </div>
          <div className="grid min-w-0 flex-1 gap-2 sm:max-w-md sm:grid-cols-2">
            <AskBox label={t("farmerAsking")} hint={t("farmerAskingHint")} value={weOwe} active={weOwe > 0} />
            <AskBox label={t("weAsking")} hint={t("weAskingHint")} value={theyOwe} active={theyOwe > 0} />
          </div>
        </div>
        {weOwe === 0 && theyOwe === 0 ? (
          <p className="relative mt-3 text-[13px] text-emerald-100">{t("settledNow")}</p>
        ) : null}
        <div className="relative mt-4 grid grid-cols-3 gap-1.5 sm:gap-3">
          <HeroMini label={t("milkAmt")} value={formatInr(summary.milk)} hint={t("slipsQty", { n: summary.slips, qty: formatQty(summary.qty) })} />
          <HeroMini label={t("advanceGiven")} value={formatInr(summary.open)} hint={`${summary.openCount}`} warn={summary.open > 0} />
          <HeroMini label={t("paidToFarmer")} value={formatInr(summary.paid)} hint={summary.pendingBills ? t("unpaid") : t("paid")} />
        </div>
        {farmerId ? (
          <div className="relative mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href={`/payments?tab=advances&farmer=${farmerId}`} className={`${btnInverse} w-full sm:w-auto`}>
              {t("giveAdvance")}
            </Link>
            <Link href={`/payments?tab=bills`} className={`${btnGhost} w-full border-white/20 bg-white/10 text-white hover:bg-white/20 sm:w-auto`}>
              {t("farmerPayments")}
            </Link>
          </div>
        ) : null}
      </section>

      <div className="chip-row">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={t("ledgerAll")} count={rows.length} />
        <FilterChip active={filter === "slip"} onClick={() => setFilter("slip")} label={t("milkAmt")} count={rows.filter((r) => r.kind === "slip").length} />
        <FilterChip active={filter === "advance"} onClick={() => setFilter("advance")} label={t("advanceGiven")} count={rows.filter((r) => r.kind === "advance").length} />
        <FilterChip active={filter === "bill"} onClick={() => setFilter("bill")} label={t("ledgerBills")} count={rows.filter((r) => r.kind === "bill").length} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-lg">{t("ledgerTitle")}</h3>
          <p className="mt-0.5 text-[12px] text-muted">{t("ledgerHint")}</p>
        </div>
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">{t("ledgerEmpty")}</p>
        ) : (
          <ol className="divide-y divide-line/70">
            {paged.map((row) => {
              const Icon = row.kind === "advance" ? Banknote : row.kind === "bill" ? Receipt : Droplets;
              const tone =
                row.kind === "advance"
                  ? "bg-amber-50 text-amber-800"
                  : row.kind === "bill"
                    ? "bg-[#f4ead6] text-foreground"
                    : "bg-emerald-50 text-primary";
              const inner = (
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.title}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {formatDateTime(row.at)} · {row.status}
                    </p>
                    {row.note ? <p className="mt-0.5 truncate text-[12px] text-muted">{row.note}</p> : null}
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    {row.credit ? <p className="text-[15px] font-semibold text-primary">+{formatInr(row.credit)}</p> : null}
                    {row.debit ? <p className="text-[15px] font-semibold text-danger">−{formatInr(row.debit)}</p> : null}
                    <p className="text-[11px] text-muted">{formatInr(row.balance)}</p>
                  </div>
                </div>
              );
              return (
                <li key={row.id}>
                  {row.href ? (
                    <Link href={row.href} className="block px-4 py-3.5 hover:bg-[#faf6ee]">
                      {inner}
                    </Link>
                  ) : (
                    <div className="px-4 py-3.5">{inner}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {shown.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
            <button type="button" className={btnGhost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("prev")}
            </button>
            <p className="text-[13px] text-muted">{t("pageOf", { page, pages })}</p>
            <button type="button" className={btnGhost} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              {t("next")}
            </button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function AskBox({
  label,
  hint,
  value,
  active,
}: {
  label: string;
  hint: string;
  value: number;
  active: boolean;
}) {
  return (
    <div className={`rounded-2xl px-3 py-2.5 ${active ? "bg-white text-primary" : "bg-white/10 text-white"}`}>
      <p className={`text-[11px] ${active ? "text-primary/70" : "text-white/70"}`}>{label}</p>
      <p className="mt-1 font-display text-[24px] leading-none tabular-nums">{formatInr(value)}</p>
      <p className={`mt-1 text-[11px] ${active ? "text-primary/70" : "text-white/65"}`}>{hint}</p>
    </div>
  );
}

function HeroMini({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl px-2.5 py-2.5 sm:px-3 ${warn ? "bg-amber-300/20" : "bg-white/10"}`}>
      <p className="truncate text-[10px] text-white/70 sm:text-[11px]">{label}</p>
      <p className="mt-1 truncate font-display text-[16px] leading-none tabular-nums sm:text-[20px]">{value}</p>
      <p className="mt-1 truncate text-[10px] text-white/60">{hint}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button type="button" onClick={onClick} className={active ? btnPrimary : btnGhost}>
      {label}
      <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/20" : "bg-[#f4ead6] text-muted"}`}>{count}</span>
    </button>
  );
}

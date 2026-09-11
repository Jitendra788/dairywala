"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useMemo } from "react";
import { formatDate, formatDateRange } from "@/lib/dates";
import { formatInr, round2 } from "@/lib/money";
import { Card } from "@/components/ui";
import type { DayPoint, FinanceGrain, FinanceReport } from "@/lib/finance/types";

const LINES = [
  { key: "subscription", label: "Sells", color: "#187a48" },
  { key: "counter", label: "Counter sales", color: "#2563eb" },
  { key: "purchase", label: "Purchases", color: "#94a3b8" },
  { key: "expense", label: "Expenses", color: "#d97706" },
  { key: "earning", label: "Earnings", color: "#0f766e" },
] as const;

function grainKey(date: string, grain: FinanceGrain) {
  if (grain === "year") return date.slice(0, 4);
  if (grain === "month") return date.slice(0, 7);
  if (grain === "week") {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const day = (dt.getDay() + 6) % 7;
    dt.setDate(dt.getDate() - day);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }
  return date;
}

function grainLabel(key: string, grain: FinanceGrain) {
  if (grain === "year") return key;
  if (grain === "month") {
    const [y, m] = key.split("-");
    return `${m}/${y}`;
  }
  return formatDate(key);
}

function rollup(series: DayPoint[], grain: FinanceGrain): DayPoint[] {
  const map = new Map<string, DayPoint>();
  for (const point of series) {
    const key = grainKey(point.date, grain);
    const cur = map.get(key) ?? empty(key);
    cur.subscription += point.subscription;
    cur.counter += point.counter;
    cur.purchase += point.purchase;
    cur.expense += point.expense;
    cur.earning += point.earning;
    map.set(key, cur);
  }
  return [...map.values()].map((p) => ({
    ...p,
    subscription: round2(p.subscription),
    counter: round2(p.counter),
    purchase: round2(p.purchase),
    expense: round2(p.expense),
    earning: round2(p.earning),
  }));
}

function empty(date: string): DayPoint {
  return { date, subscription: 0, counter: 0, purchase: 0, expense: 0, earning: 0 };
}

export function SparkLines({
  series,
  grain = "day",
}: {
  series: DayPoint[];
  grain?: FinanceGrain;
}) {
  const rows = useMemo(() => rollup(series, grain), [series, grain]);
  const width = 720;
  const height = 168;
  const pad = 18;
  const max = Math.max(1, ...rows.flatMap((p) => [p.subscription, p.counter, p.purchase, p.expense, p.earning]));
  const step = rows.length > 1 ? (width - pad * 2) / (rows.length - 1) : 0;

  function path(key: (typeof LINES)[number]["key"]) {
    return rows
      .map((point, i) => {
        const x = pad + i * step;
        const y = height - pad - (point[key] / max) * (height - pad * 2);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full min-w-[420px]">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e5ddd0" />
        {LINES.map((line) => (
          <path key={line.key} d={path(line.key)} fill="none" stroke={line.color} strokeWidth="2" />
        ))}
        {rows.map((point, i) => (
          <text
            key={point.date}
            x={pad + i * step}
            y={height - 2}
            textAnchor="middle"
            className="fill-current text-[8px] text-muted"
          >
            {grainLabel(point.date, grain)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">
        {LINES.map((line) => (
          <span key={line.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: line.color }} />
            {line.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EarningReportCard({
  report,
  includeDeleted,
  onIncludeDeleted,
  periodLabel,
  periodControl,
}: {
  report: FinanceReport;
  includeDeleted: boolean;
  onIncludeDeleted: (value: boolean) => void;
  periodLabel: string;
  periodControl?: ReactNode;
}) {
  const t = report.totals;
  return (
    <Card id="earning" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-primary">Earning report</p>
          <p className="mt-1 text-[13px] text-muted">Sales, purchases, expenses and earnings over time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12px] text-muted">
            <input type="checkbox" checked={includeDeleted} onChange={(e) => onIncludeDeleted(e.target.checked)} />
            Include deleted
          </label>
          {periodControl}
          <span className="rounded-full bg-[#f4ead6] px-2.5 py-1 text-[11px] font-medium">{periodLabel}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Subscription sale" value={formatInr(t.subscription)} />
        <Kpi label="Counter sales" value={formatInr(t.counter)} />
        <Kpi label="Total purchase" value={formatInr(t.purchase)} />
        <Kpi label="Net earning" value={formatInr(t.earning)} accent />
      </div>
      <div className="mt-4">
        <SparkLines series={report.series} />
      </div>
    </Card>
  );
}

export function ProfitLossCard({
  report,
  grain,
  onGrain,
}: {
  report: FinanceReport;
  grain: FinanceGrain;
  onGrain: (grain: FinanceGrain) => void;
}) {
  const t = report.totals;
  return (
    <Card id="pnl" className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-primary">Profit & Loss</p>
          <p className="mt-1 text-[13px] text-muted">Period: {formatDateRange(report.from, report.to)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["day", "week", "month", "year"] as FinanceGrain[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onGrain(item)}
              className={`rounded-full px-3 py-1 text-[12px] capitalize ${
                grain === item ? "bg-primary text-white" : "bg-[#f4ead6] text-muted"
              }`}
            >
              {item}
            </button>
          ))}
          <Link href="/reports#pnl" className="text-[12px] font-semibold text-primary">
            View detail →
          </Link>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Net profit</p>
          <p className="mt-1 font-display text-3xl">{formatInr(t.earning)}</p>
          <p className="mt-3 text-[11px] text-muted">Profit margin</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#efe6d4]">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, t.margin))}%` }} />
          </div>
          <p className="mt-1 text-[12px] font-medium">{t.margin.toFixed(1)}%</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Inflow" value={formatInr(t.inflow)} />
          <Kpi label="Outflow" value={formatInr(t.outflow)} />
          <div className="col-span-2">
            <p className="mb-1 text-[11px] text-muted">Net trend · {grain}</p>
            <SparkLines series={report.series} grain={grain} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function TodayMissionCard({ report }: { report: FinanceReport }) {
  const m = report.today.mission;
  const p = report.today.pnl;
  const pct = m.total ? Math.round((m.delivered / m.total) * 100) : 0;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-primary">Today’s mission</p>
            <h2 className="font-display text-lg">Delivery progress</h2>
          </div>
          <Link href="/customers/delivery" className="text-[12px] font-semibold text-primary">
            Open delivery list →
          </Link>
        </div>
        <div className="mt-4 flex items-center gap-5">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#efe6d4" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="#187a48"
                strokeWidth="8"
                strokeDasharray={`${(pct / 100) * 201} 201`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute font-display text-xl">{m.delivered}</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="text-muted">of {m.total}</p>
            <Dot color="#187a48" label="Delivered" value={m.delivered} />
            <Dot color="#d97706" label="Pending" value={m.pending} />
            <Dot color="#dc2626" label="Missed" value={m.missed} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] text-muted">
          <p>Morning · {m.morningDone} of {m.morningTotal} done</p>
          <p>Evening · {m.eveningDone} of {m.eveningTotal} done</p>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-primary">Today’s P&L</p>
            <h2 className="font-display text-lg">Cash flow by channel</h2>
          </div>
          <Link href="/reports#earning" className="text-[12px] font-semibold text-primary">
            Full report →
          </Link>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <Flow label="Morning sales" value={p.morningSales} plus />
          <Flow label="Evening sales" value={p.eveningSales} plus />
          <Flow label="Counter sales" value={p.counterSales} plus />
          <Flow label="Purchase" value={p.purchase} />
          <Flow label="Expenses" value={p.expense} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <p className="text-[12px] text-muted">Net earning</p>
          <div className="text-right">
            <p className="font-display text-2xl">{formatInr(p.earning)}</p>
            <p className="text-[11px] text-muted">{p.margin.toFixed(1)}% margin</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl px-3 py-2.5 ${accent ? "bg-emerald-50" : "bg-[#f7f1e6]"}`}>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-[22px] leading-none">{value}</p>
    </div>
  );
}

function Dot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <p className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
      <span className="ml-auto font-medium text-foreground">{value}</span>
    </p>
  );
}

function Flow({ label, value, plus }: { label: string; value: number; plus?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={plus ? "text-primary" : "text-danger"}>
        {plus ? "+" : "−"}
        {formatInr(value)}
      </span>
    </div>
  );
}

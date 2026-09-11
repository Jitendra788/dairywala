"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CloudUpload,
  Moon,
  MoreVertical,
  Printer,
  Sun,
  UserRound,
} from "lucide-react";
import { currentShift, formatDate, todayISO } from "@/lib/dates";
import { farmerLabel } from "@/lib/farmer-label";
import { slipRef } from "@/lib/ref";
import { round2 } from "@/lib/money";
import { calcAmount, methodForMilk, pickChart, quoteRate } from "@/lib/rate";
import { useDairy } from "@/hooks/use-dairy";
import { BuffaloIcon, CowIcon, MilkCans } from "@/components/hamari/icons";
import { Select } from "@/components/ui";
import type { MilkType, Shift } from "@/lib/types";

export function BuyMilkScreen() {
  const dairy = useDairy();
  const codeRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(todayISO());
  const [shift, setShift] = useState<Shift>(currentShift());
  const [printOn, setPrintOn] = useState(true);
  const [smsOn, setSmsOn] = useState(true);
  const [filter, setFilter] = useState<"all" | MilkType>("all");
  const [code, setCode] = useState("");
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");
  const [milkType, setMilkType] = useState<MilkType>("cow");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState(false);

  const farmer = dairy.farmerByCode(code);
  const method = methodForMilk(dairy.settings, milkType);
  const chart = pickChart(dairy.charts, milkType, method);
  const quote = quoteRate(chart, Number(fat), Number(snf));
  const rate = quote.rate;
  const total = calcAmount(Number(weight), rate);

  const rows = useMemo(
    () =>
      dairy.entries.filter(
        (e) =>
          e.date === date &&
          e.shift === shift &&
          (filter === "all" || e.milkType === filter),
      ),
    [dairy.entries, date, shift, filter],
  );

  const summary = useMemo(() => summarize(rows), [rows]);

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!farmer) return;
    const prev = dairy.lastEntryForFarmer(farmer.id);
    if (prev) {
      setMilkType(prev.milkType);
      setFat(String(prev.fat));
      setSnf(String(prev.snf));
    } else {
      setSnf(milkType === "cow" ? "8.5" : "9.0");
    }
  }, [farmer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setCode("");
    setWeight("");
    codeRef.current?.focus();
  }

  async function save() {
    if (!farmer || !Number(weight) || !Number(fat)) return;
    const usedSnf = Number(snf) || (milkType === "cow" ? 8.5 : 9.0);
    const entry = await dairy.addCollection({
      farmerId: farmer.id,
      date,
      shift,
      milkType,
      qty: Number(weight),
      fat: Number(fat),
      snf: usedSnf,
      clr: 0,
    });
    if (printOn) {
      window.open(`/collection/${entry.id}`, "_blank");
    }
    resetForm();
  }

  const last = farmer ? dairy.lastEntryForFarmer(farmer.id) : undefined;

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-sm">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 rounded-lg border border-line px-2 text-sm"
        />
        <span className="text-sm text-muted">{formatDate(date)}</span>
        <span className="text-sm font-medium">
          Shift <span className="text-danger">*</span>
        </span>
        <button
          type="button"
          onClick={() => setShift("morning")}
          className={`flex h-9 items-center gap-1 rounded-lg px-3 text-sm ${
            shift === "morning" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Sun size={14} /> Mor.
        </button>
        <button
          type="button"
          onClick={() => setShift("evening")}
          className={`flex h-9 items-center gap-1 rounded-lg px-3 text-sm ${
            shift === "evening" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Moon size={14} /> Eve.
        </button>
        <label className="ml-2 flex items-center gap-1 text-sm">
          <input type="checkbox" checked={printOn} onChange={(e) => setPrintOn(e.target.checked)} />
          Print
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={smsOn} onChange={(e) => setSmsOn(e.target.checked)} />
          SMS
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="rounded-lg border border-line p-2 text-slate-500" aria-label="Sync">
            <CloudUpload size={16} />
          </button>
          <Select
            className="h-9 rounded-lg bg-primary px-2 text-sm text-white"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">Show</option>
            <option value="cow">Cow</option>
            <option value="buffalo">Buffalo</option>
          </Select>
          <button
            type="button"
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-white"
            onClick={() => window.print()}
          >
            <span className="inline-flex items-center gap-1">
              <Printer size={14} /> Print All
            </span>
          </button>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
            <UserRound size={16} />
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-xl bg-card px-4 py-3 text-sm shadow-sm">
        <AnimalSum
          icon={<CowIcon className="h-8 w-8 text-sky-600" />}
          fat={summary.cow.fat}
          snf={summary.cow.snf}
          weight={summary.cow.weight}
        />
        <AnimalSum
          icon={<BuffaloIcon className="h-8 w-8 text-amber-800" />}
          fat={summary.buffalo.fat}
          snf={summary.buffalo.snf}
          weight={summary.buffalo.weight}
        />
        <div className="ml-auto flex flex-wrap items-center gap-5 text-slate-600">
          <Mix label="Records" value={String(summary.records)} />
          <Mix label="FAT" value={summary.mixFat.toFixed(2)} />
          <Mix label="SNF" value={summary.mixSnf.toFixed(2)} />
          <Mix label="Weight" value={summary.weight.toFixed(1)} />
          <Mix label="Rate" value={summary.rate.toFixed(1)} prefix="₹ " />
          <div>
            <p className="text-[11px] text-muted">Amount</p>
            <p className="text-lg font-semibold text-slate-800">₹ {summary.amount.toFixed(1)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
        <div className="rounded-xl bg-card p-4 shadow-sm">
          <div className="flex gap-2">
            <label className="w-20 text-xs">
              Code<span className="text-danger">*</span>
              <input
                ref={codeRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") document.getElementById("weight-input")?.focus();
                }}
                className="mt-1 h-10 w-full rounded-lg border border-line px-2 text-sm"
              />
            </label>
            <label className="flex-1 text-xs">
              Name
              <input
                readOnly
                value={farmer?.name ?? ""}
                className="mt-1 h-10 w-full rounded-lg border border-line bg-slate-50 px-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-slate-600">
            <span>💧 {fat || last?.fat || "—"}</span>
            <span>🥛 {last?.qty ?? "—"}</span>
            <span>₹ {last ? last.rate.toFixed(2) : "—"}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs">
              Weight<span className="text-danger">*</span>
              <input
                id="weight-input"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-line px-2 text-sm"
              />
            </label>
            <label className="text-xs">
              FAT<span className="text-danger">*</span>
              <div className="mt-1 flex gap-1">
                <input
                  inputMode="decimal"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className="h-10 w-full rounded-lg border border-line px-2 text-sm"
                />
                <button
                  type="button"
                  title="Toggle cow / buffalo"
                  onClick={() =>
                    setMilkType((t) => {
                      const next = t === "cow" ? "buffalo" : "cow";
                      if (!farmer) setSnf(next === "cow" ? "8.5" : "9.0");
                      return next;
                    })
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-line"
                >
                  {milkType === "cow" ? (
                    <CowIcon className="h-5 w-5 text-sky-600" />
                  ) : (
                    <BuffaloIcon className="h-5 w-5 text-amber-800" />
                  )}
                </button>
              </div>
            </label>
          </div>

          <input
            className="mt-2 h-8 w-full rounded-lg border border-dashed border-line px-2 text-xs"
            placeholder="SNF (auto from last / analyzer)"
            inputMode="decimal"
            value={snf}
            onChange={(e) => setSnf(e.target.value)}
          />

          <div className="mt-3 flex justify-between text-sm font-semibold text-primary">
            <span>RS/Ltr: {rate ? rate.toFixed(2) : "0.00"}</span>
            <span>Total: {total ? total.toFixed(2) : "0.00"}</span>
          </div>
          {quote.rule && Number(fat) ? (
            <p className={`mt-1 text-[11px] ${quote.rejected ? "text-danger" : "text-muted"}`}>
              {quote.payPercent}% · {quote.rule.label}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="h-10 flex-1 rounded-lg border border-primary text-sm font-medium text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!farmer || !Number(weight) || !Number(fat)}
              className="h-10 flex-1 rounded-lg bg-primary text-sm font-medium text-white disabled:opacity-40"
            >
              Save
            </button>
          </div>

          <MilkCans />

          <button
            type="button"
            className="mt-3 text-xs text-primary"
            onClick={() => setShortcuts((v) => !v)}
          >
            Shortcut Keys {shortcuts ? "v" : ">"}
          </button>
          {shortcuts ? (
            <p className="mt-1 text-[11px] text-muted">Enter: next field · Save after FAT · Esc cancel</p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Sr No</th>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Weight</th>
                <th className="px-3 py-2 font-medium">FAT</th>
                <th className="px-3 py-2 font-medium">SNF</th>
                <th className="px-3 py-2 font-medium">Rate</th>
                <th className="px-3 py-2 font-medium">Net Amt.</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-muted">
                    No records for this shift
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => {
                  const f = dairy.farmerById(row.farmerId);
                  return (
                    <tr key={row.id} className="border-t border-line">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">{slipRef(row.id)}</td>
                      <td className="px-3 py-2">
                        {farmerLabel(f)}
                      </td>
                      <td className="px-3 py-2">
                        {row.milkType === "cow" ? (
                          <CowIcon className="h-5 w-5 text-sky-600" />
                        ) : (
                          <BuffaloIcon className="h-5 w-5 text-amber-800" />
                        )}
                      </td>
                      <td className="px-3 py-2">{row.qty}</td>
                      <td className="px-3 py-2">{row.fat}</td>
                      <td className="px-3 py-2">{row.snf}</td>
                      <td className="px-3 py-2">{row.rate.toFixed(1)}</td>
                      <td className="px-3 py-2">{row.amount.toFixed(1)}</td>
                      <td className="relative px-3 py-2">
                        <button type="button" onClick={() => setMenuId(menuId === row.id ? null : row.id)}>
                          <MoreVertical size={16} className="text-slate-400" />
                        </button>
                        {menuId === row.id ? (
                          <div className="absolute right-3 z-10 w-28 rounded-lg border border-line bg-card py-1 text-xs shadow-lg">
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                              onClick={() => {
                                setCode(f?.code ?? "");
                                setWeight(String(row.qty));
                                setFat(String(row.fat));
                                setSnf(String(row.snf));
                                setMilkType(row.milkType);
                                setMenuId(null);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left text-danger hover:bg-slate-50 disabled:opacity-40"
                              disabled={Boolean(row.billId)}
                              onClick={() => {
                                void dairy.deleteCollection(row.id);
                                setMenuId(null);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AnimalSum({
  icon,
  fat,
  snf,
  weight,
}: {
  icon: ReactNode;
  fat: number;
  snf: number;
  weight: number;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex gap-4 text-xs">
        <span>
          <span className="text-muted">FAT</span>
          <br />
          <b>{fat.toFixed(1)}</b>
        </span>
        <span>
          <span className="text-muted">SNF</span>
          <br />
          <b>{snf.toFixed(1)}</b>
        </span>
        <span>
          <span className="text-muted">Weight</span>
          <br />
          <b>{weight.toFixed(1)}</b>
        </span>
      </div>
    </div>
  );
}

function Mix({ label, value, prefix = "" }: { label: string; value: string; prefix?: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-semibold">
        {prefix}
        {value}
      </p>
    </div>
  );
}

function summarize(rows: { milkType: MilkType; qty: number; fat: number; snf: number; rate: number; amount: number }[]) {
  const group = (type: MilkType) => {
    const list = rows.filter((r) => r.milkType === type);
    const weight = list.reduce((s, r) => s + r.qty, 0);
    return {
      weight: round2(weight),
      fat: weight ? round2(list.reduce((s, r) => s + r.fat * r.qty, 0) / weight) : 0,
      snf: weight ? round2(list.reduce((s, r) => s + r.snf * r.qty, 0) / weight) : 0,
    };
  };
  const weight = rows.reduce((s, r) => s + r.qty, 0);
  const amount = rows.reduce((s, r) => s + r.amount, 0);
  return {
    cow: group("cow"),
    buffalo: group("buffalo"),
    records: rows.length,
    weight: round2(weight),
    amount: round2(amount),
    mixFat: weight ? round2(rows.reduce((s, r) => s + r.fat * r.qty, 0) / weight) : 0,
    mixSnf: weight ? round2(rows.reduce((s, r) => s + r.snf * r.qty, 0) / weight) : 0,
    rate: weight ? round2(amount / weight) : 0,
  };
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Printer, Trash2 } from "lucide-react";
import { currentShift, formatDate, todayISO } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import { calcAmount, lookupRate, pickChart } from "@/lib/rate";
import { useDairy } from "@/hooks/use-dairy";
import { btnPrimary, Card, Field, inputClass } from "@/components/ui";
import type { MilkType, Shift } from "@/lib/types";

export function CollectionDesk() {
  const dairy = useDairy();
  const codeRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(todayISO());
  const [shift, setShift] = useState<Shift>(currentShift());
  const [milkType, setMilkType] = useState<MilkType>("buffalo");
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("");
  const [fat, setFat] = useState("");
  const [snf, setSnf] = useState("");
  const [clr, setClr] = useState("");
  const [error, setError] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);

  const farmer = dairy.farmerByCode(code);
  const chart = pickChart(dairy.charts, milkType);
  const rate = lookupRate(chart, Number(fat), Number(snf));
  const amount = calcAmount(Number(qty), rate);

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!farmer) return;
    const prev = dairy.lastEntryForFarmer(farmer.id);
    if (!prev) return;
    setMilkType(prev.milkType);
    setFat(String(prev.fat));
    setSnf(String(prev.snf));
    setClr(String(prev.clr));
  }, [farmer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(
    () => dairy.entries.filter((e) => e.date === date && e.shift === shift),
    [dairy.entries, date, shift],
  );

  const totals = rows.reduce(
    (acc, row) => {
      acc.qty += row.qty;
      acc.amount += row.amount;
      return acc;
    },
    { qty: 0, amount: 0 },
  );

  function resetLine() {
    setCode("");
    setQty("");
    setError("");
    codeRef.current?.focus();
  }

  function onSave() {
    setError("");
    if (!farmer) {
      setError("Farmer code nahi mila. Pehle farmer add karo.");
      return;
    }
    if (!Number(qty) || !Number(fat) || !Number(snf)) {
      setError("Qty, FAT aur SNF zaroori hain.");
      return;
    }
    const entry = dairy.addCollection({
      farmerId: farmer.id,
      date,
      shift,
      milkType,
      qty: Number(qty),
      fat: Number(fat),
      snf: Number(snf),
      clr: Number(clr) || 0,
    });
    setLastId(entry.id);
    resetLine();
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="flex flex-col p-4">
        <div className="flex gap-1">
          <Toggle
            value={shift}
            onChange={setShift}
            options={[
              { value: "morning", label: "Morning" },
              { value: "evening", label: "Evening" },
            ]}
          />
          <Toggle
            value={milkType}
            onChange={setMilkType}
            options={[
              { value: "buffalo", label: "Buffalo" },
              { value: "cow", label: "Cow" },
            ]}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Field label="Date">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Farmer code">
            <input
              ref={codeRef}
              className={inputClass}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.getElementById("qty-input")?.focus();
                }
              }}
              placeholder="101"
            />
          </Field>
        </div>

        <p className="mt-2 min-h-5 text-[13px] font-medium text-primary">
          {farmer
            ? `${farmer.name} · ${formatInr(dairy.farmerBalance(farmer.id))}`
            : code
              ? "Code nahi mila"
              : " "}
        </p>

        <div className="mt-1 grid grid-cols-2 gap-2.5">
          <Field label="Qty (L)">
            <input id="qty-input" inputMode="decimal" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label="CLR">
            <input inputMode="decimal" className={inputClass} value={clr} onChange={(e) => setClr(e.target.value)} />
          </Field>
          <Field label="FAT %">
            <input inputMode="decimal" className={inputClass} value={fat} onChange={(e) => setFat(e.target.value)} />
          </Field>
          <Field label="SNF %">
            <input inputMode="decimal" className={inputClass} value={snf} onChange={(e) => setSnf(e.target.value)} />
          </Field>
        </div>

        <div className="mt-3 rounded-xl bg-emerald-50/80 px-3 py-2.5 text-sm">
          <p className="text-[10px] text-muted">{chart?.name ?? "No rate chart"}</p>
          <div className="mt-0.5 flex justify-between text-[13px]">
            <span className="text-muted">Rate / L</span>
            <span>{rate ? formatInr(rate) : "—"}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Amount</span>
            <span className="text-primary">{qty && rate ? formatInr(amount) : "—"}</span>
          </div>
        </div>

        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

        <button type="button" className={`${btnPrimary} mt-3 w-full`} onClick={onSave}>
          Save slip
        </button>
        {lastId ? (
          <Link href={`/collection/${lastId}`} className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-primary">
            <Printer size={14} /> Print last slip
          </Link>
        ) : null}
      </Card>

      <Card className="flex min-h-0 flex-col overflow-hidden p-0">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="font-display text-lg leading-none">Shift desk</h2>
            <p className="mt-1 text-xs text-muted">
              {formatDate(date)} · {shift} · {formatQty(totals.qty)} · {formatInr(totals.amount)}
            </p>
          </div>
          <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted">{rows.length} slips</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-card text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">Farmer</th>
                <th className="py-2 font-medium">Milk</th>
                <th className="py-2 font-medium">L</th>
                <th className="py-2 font-medium">FAT</th>
                <th className="py-2 font-medium">SNF</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    Is shift mein koi slip nahi. Code daal ke save karo.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const f = dairy.farmerById(row.farmerId);
                  return (
                    <tr key={row.id} className="border-t border-line/80 hover:bg-background/60">
                      <td className="px-4 py-2">
                        <Link href={`/collection/${row.id}`} className="hover:text-primary">
                          {f?.code} · {f?.name}
                        </Link>
                      </td>
                      <td className="capitalize">{row.milkType}</td>
                      <td>{row.qty}</td>
                      <td>{row.fat}</td>
                      <td>{row.snf}</td>
                      <td className="font-medium">{formatInr(row.amount)}</td>
                      <td className="px-3 text-right">
                        <button
                          type="button"
                          className="p-1 text-muted hover:text-danger disabled:opacity-30"
                          disabled={Boolean(row.billId)}
                          onClick={() => dairy.deleteCollection(row.id)}
                          aria-label="Delete slip"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Toggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-1 rounded-lg bg-background p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium ${
            value === opt.value ? "bg-primary text-white" : "text-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

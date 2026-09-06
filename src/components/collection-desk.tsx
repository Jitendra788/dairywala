"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, Printer, Trash2 } from "lucide-react";
import { currentShift, formatDate, todayISO } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import { calcAmount, lookupRate, METHOD_LABEL, pickChart } from "@/lib/rate";
import { useDairy } from "@/hooks/use-dairy";
import { btnPrimary, Card, Field, Initials, MilkBadge, inputClass } from "@/components/ui";
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
  const [editingId, setEditingId] = useState<string | null>(null);

  const farmer = dairy.farmerByCode(code);
  const chart = pickChart(dairy.charts, milkType, dairy.settings.rateMethod);
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
    setEditingId(null);
    codeRef.current?.focus();
  }

  function loadEdit(id: string) {
    const row = dairy.entries.find((e) => e.id === id);
    const f = row ? dairy.farmerById(row.farmerId) : undefined;
    if (!row || !f) return;
    if (row.billId) {
      setError("Billed slip edit nahi ho sakti");
      return;
    }
    setEditingId(row.id);
    setDate(row.date);
    setShift(row.shift);
    setMilkType(row.milkType);
    setCode(f.code);
    setQty(String(row.qty));
    setFat(String(row.fat));
    setSnf(String(row.snf));
    setClr(String(row.clr));
    setError("");
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
    const payload = {
      farmerId: farmer.id,
      date,
      shift,
      milkType,
      qty: Number(qty),
      fat: Number(fat),
      snf: Number(snf),
      clr: Number(clr) || 0,
    };
    try {
      if (editingId) {
        dairy.updateCollection(editingId, payload);
        setLastId(editingId);
      } else {
        const entry = dairy.addCollection(payload);
        setLastId(entry.id);
      }
      resetLine();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save nahi hua");
    }
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="flex flex-col p-4">
        <div className="flex gap-1.5">
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

        <div className="mt-3 min-h-[52px] rounded-2xl bg-[#f7f1e6] px-3 py-2">
          {farmer ? (
            <div className="flex items-center gap-2">
              <Initials name={farmer.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{farmer.name}</p>
                <p className="text-[11px] text-muted">Balance {formatInr(dairy.farmerBalance(farmer.id))}</p>
              </div>
            </div>
          ) : (
            <p className="py-1.5 text-[13px] text-muted">
              {code ? "Code nahi mila — farmer add karo" : "Farmer code daalo"}
            </p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
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

        <div className="mt-3 rounded-2xl bg-primary px-3.5 py-3 text-white">
          <p className="text-[10px] text-white/70">
            {METHOD_LABEL[dairy.settings.rateMethod]} · {chart?.name ?? "No chart"}
          </p>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <p className="text-[11px] text-white/70">Rate / L</p>
              <p className="text-sm font-semibold">{rate ? formatInr(rate) : "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-white/70">Amount</p>
              <p className="font-display text-2xl leading-none">{qty && rate ? formatInr(amount) : "—"}</p>
            </div>
          </div>
        </div>

        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

        <div className="mt-3 flex gap-2">
          <button type="button" className={`${btnPrimary} flex-1 py-2.5`} onClick={onSave}>
            {editingId ? "Update slip" : "Save slip"}
          </button>
          {editingId ? (
            <button type="button" className="rounded-xl border border-line px-3 text-sm" onClick={resetLine}>
              Cancel
            </button>
          ) : null}
        </div>
        {lastId ? (
          <Link href={`/collection/${lastId}`} className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary">
            <Printer size={14} /> Print last slip
          </Link>
        ) : null}
      </Card>

      <Card className="flex min-h-0 flex-col overflow-hidden p-0">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="font-display text-lg leading-none">Shift desk</h2>
            <p className="mt-1 text-xs text-muted">
              {formatDate(date)} · {shift} · {formatQty(totals.qty)} · {formatInr(totals.amount)}
            </p>
          </div>
          <span className="rounded-full bg-[#f4ead6] px-2.5 py-1 text-xs font-medium">{rows.length} slips</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="divide-y divide-line/70 md:hidden">
            {rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">Is shift mein koi slip nahi. Code daal ke save karo.</p>
            ) : (
              rows.map((row) => {
                const f = dairy.farmerById(row.farmerId);
                return (
                  <div key={row.id} className="flex items-start gap-3 px-4 py-3">
                    <Link href={`/collection/${row.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                      <Initials name={f?.name ?? "F"} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{f?.name}</span>
                        <span className="text-[11px] text-muted">{row.qty} L · FAT {row.fat} · SNF {row.snf}</span>
                      </span>
                    </Link>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-semibold">{formatInr(row.amount)}</p>
                      <div className="mt-1">
                        <button type="button" className="mr-1 rounded-lg p-1 text-muted hover:bg-[#f4ead6] hover:text-primary disabled:opacity-30" disabled={Boolean(row.billId)} onClick={() => loadEdit(row.id)} aria-label="Edit slip">
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1 text-muted hover:bg-red-50 hover:text-danger disabled:opacity-30"
                          disabled={Boolean(row.billId)}
                          onClick={() => {
                            if (!confirm("Is slip ko delete karein?")) return;
                            try {
                              dairy.deleteCollection(row.id);
                              if (editingId === row.id) resetLine();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : "Delete nahi hua");
                            }
                          }}
                          aria-label="Delete slip"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <table className="hidden w-full text-left text-[13px] md:table">
            <thead className="table-head sticky top-0 text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Farmer</th>
                <th className="py-2.5 font-medium">Milk</th>
                <th className="py-2.5 font-medium">L</th>
                <th className="py-2.5 font-medium">FAT</th>
                <th className="py-2.5 font-medium">SNF</th>
                <th className="py-2.5 font-medium">Amount</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-muted">
                    Is shift mein koi slip nahi. Code daal ke save karo.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const f = dairy.farmerById(row.farmerId);
                  return (
                    <tr key={row.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                      <td className="px-4 py-2.5">
                        <Link href={`/collection/${row.id}`} className="flex items-center gap-2 hover:text-primary">
                          <Initials name={f?.name ?? "F"} />
                          <span>
                            <span className="block font-medium">{f?.name}</span>
                            <span className="text-[11px] text-muted">{f?.code}</span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <MilkBadge type={row.milkType} />
                      </td>
                      <td>{row.qty}</td>
                      <td>{row.fat}</td>
                      <td>{row.snf}</td>
                      <td className="font-semibold">{formatInr(row.amount)}</td>
                      <td className="px-3 text-right">
                        <button
                          type="button"
                          className="mr-1 rounded-lg p-1 text-muted hover:bg-[#f4ead6] hover:text-primary disabled:opacity-30"
                          disabled={Boolean(row.billId)}
                          onClick={() => loadEdit(row.id)}
                          aria-label="Edit slip"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1 text-muted hover:bg-red-50 hover:text-danger disabled:opacity-30"
                          disabled={Boolean(row.billId)}
                          onClick={() => {
                            if (!confirm("Is slip ko delete karein?")) return;
                            try {
                              dairy.deleteCollection(row.id);
                              if (editingId === row.id) resetLine();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : "Delete nahi hua");
                            }
                          }}
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
    <div className="flex flex-1 rounded-xl bg-[#f4ead6] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-[10px] px-2 py-1.5 text-[11px] font-semibold ${
            value === opt.value ? "bg-primary text-white shadow-sm" : "text-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

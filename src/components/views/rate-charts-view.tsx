"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, ChevronDown, Droplets, SlidersHorizontal } from "lucide-react";
import {
  chartAxes,
  defaultRules,
  generateBlankGrid,
  generateFatOnlyCells,
  generateFormulaCells,
  isLowKgFatRate,
  kgFatLitreRate,
  METHOD_LABEL,
  methodRowCount,
  milkKey,
  resolvedKgFatRate,
  TYPICAL_KG_FAT,
} from "@/lib/rate";
import { formatInr, round2 } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Card, Field, inputClass, PageHeader } from "@/components/ui";
import type { ChartMethod, MilkType, QualityRule, RateChart, Settings } from "@/lib/types";

const METHODS: {
  kind: ChartMethod;
  icon: ReactNode;
  hint: string;
}[] = [
  {
    kind: "fat-only",
    icon: <Droplets size={18} />,
    hint: "Buffalo: Rate/L = FAT% × (₹/kg Fat ÷ 100). Typical ₹900/kg Fat → 6% FAT = ₹54/L. SNF collection pe optional.",
  },
  {
    kind: "formula",
    icon: <Calculator size={18} />,
    hint: "Har FAT ka alag rate. Add se naya FAT daalo, Update se purana rate badlo.",
  },
  {
    kind: "grid",
    icon: <SlidersHorizontal size={18} />,
    hint: "Type your own SNF × FAT cell rates if the Excel formulas are not enough.",
  },
];

export function RateChartsView() {
  const dairy = useDairy();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState<ChartMethod | null>(dairy.settings.cowMethod ?? dairy.settings.rateMethod);
  const [milk, setMilk] = useState<MilkType>("cow");
  const [fatPage, setFatPage] = useState(0);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    const nextMilk = searchParams.get("milk");
    if (nextMilk === "cow" || nextMilk === "buffalo") setMilk(nextMilk);
    const method = searchParams.get("method");
    if (method === "fat-only" || method === "formula" || method === "grid") setOpen(method);
  }, [searchParams]);

  function chartOf(kind: ChartMethod, milkType: MilkType) {
    return dairy.charts.find((c) => c.kind === kind && milkKey(c.milkType) === milkType);
  }

  function patch(id: string, next: Partial<RateChart>) {
    dairy.saveCharts(dairy.charts.map((c) => (c.id === id ? { ...c, ...next } : c)));
    setSaved("");
  }

  function usedBy(kind: ChartMethod) {
    const cow = (dairy.settings.cowMethod ?? dairy.settings.rateMethod) === kind;
    const buffalo = (dairy.settings.buffaloMethod ?? "fat-only") === kind;
    if (cow && buffalo) return "Cow + Buffalo";
    if (cow) return "Cow";
    if (buffalo) return "Buffalo";
    return null;
  }

  function useFor(kind: ChartMethod, milkType: MilkType) {
    const patchSettings: Partial<Settings> =
      milkType === "cow" ? { cowMethod: kind, rateMethod: kind } : { buffaloMethod: kind };
    dairy.updateSettings(patchSettings);
    setOpen(kind);
    setMilk(milkType);
    setSaved(`${METHOD_LABEL[kind]} is now used for ${milkType} collection.`);
  }

  function badge(kind: ChartMethod) {
    const cow = methodRowCount(dairy.charts, kind, "cow");
    const buffalo = methodRowCount(dairy.charts, kind, "buffalo");
    if (!cow && !buffalo) return "Not set";
    return `${cow} cow • ${buffalo} buffalo rows`;
  }

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-4 sm:space-y-5">
      <PageHeader
        kicker="रेट चार्ट"
        title="Create rate chart"
        hint="Buffalo typical ₹900 / kg Fat (6% FAT ≈ ₹54 / L). Cow mein har FAT ka rate Add / Update se set karo."
      />

      {saved ? <p className="text-sm font-medium text-primary">{saved}</p> : null}

      <div className="space-y-3">
        {METHODS.map((item) => {
          const using = usedBy(item.kind);
          const expanded = open === item.kind;
          const ready = badge(item.kind) !== "Not set";
          const cowActive = using === "Cow" || using === "Cow + Buffalo";
          const buffaloActive = using === "Buffalo" || using === "Cow + Buffalo";
          return (
            <Card key={item.kind} className="min-w-0 overflow-hidden p-0">
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-3 text-left sm:gap-3 sm:px-4 sm:py-4"
                onClick={() => setOpen(expanded ? null : item.kind)}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-primary sm:h-11 sm:w-11">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="font-display text-[17px] leading-tight sm:text-lg sm:leading-none">{METHOD_LABEL[item.kind]}</span>
                    {using ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                        {using}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 line-clamp-2 hidden text-[13px] text-muted sm:block">{item.hint}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={`hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline ${
                      ready ? "bg-emerald-50 text-primary" : "bg-[#f4ead6] text-muted"
                    }`}
                  >
                    {badge(item.kind)}
                  </span>
                  <ChevronDown size={16} className={`text-muted transition ${expanded ? "rotate-180" : ""}`} />
                </span>
              </button>

              {expanded ? (
                <div className="min-w-0 border-t border-line px-3 py-3 sm:px-4 sm:py-4">
                  <p className="mb-3 text-[12px] text-muted sm:hidden">{item.hint}</p>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:hidden">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ready ? "bg-emerald-50 text-primary" : "bg-[#f4ead6] text-muted"}`}>
                      {badge(item.kind)}
                    </span>
                  </div>
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex w-full rounded-xl bg-[#f4ead6] p-0.5 sm:w-auto">
                      {(["buffalo", "cow"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`min-h-11 flex-1 rounded-[10px] px-3 py-2 text-[13px] font-semibold capitalize sm:min-h-0 sm:flex-none sm:py-1.5 sm:text-[12px] ${
                            milk === m ? "bg-primary text-white" : "text-muted"
                          }`}
                          onClick={() => {
                            setMilk(m);
                            setFatPage(0);
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <button
                        type="button"
                        className={`${cowActive ? btnGhost : btnPrimary} w-full sm:w-auto`}
                        onClick={() => useFor(item.kind, "cow")}
                      >
                        Use for Cow
                      </button>
                      <button
                        type="button"
                        className={`${buffaloActive ? btnGhost : btnPrimary} w-full sm:w-auto`}
                        onClick={() => useFor(item.kind, "buffalo")}
                      >
                        Use for Buffalo
                      </button>
                    </div>
                  </div>

                  {item.kind === "fat-only" ? (
                    milk === "cow" ? (
                      <FatRowEditor chart={chartOf("fat-only", milk)} onPatch={patch} />
                    ) : (
                      <FatOnlyEditor chart={chartOf("fat-only", milk)} onPatch={patch} />
                    )
                  ) : null}
                  {item.kind === "formula" ? (
                    <FatRowEditor chart={chartOf("formula", milk)} onPatch={patch} />
                  ) : null}
                  {item.kind === "grid" ? (
                    <ManualEditor
                      chart={chartOf("grid", milk)}
                      fatPage={fatPage}
                      onFatPage={setFatPage}
                      onPatch={patch}
                      onGenerateBlank={() => {
                        const current = chartOf("grid", milk);
                        if (!current) return;
                        patch(current.id, { cells: generateBlankGrid(current) });
                        setSaved(`${milk} manual grid ready. Type rates in the cells.`);
                      }}
                      onCopyFormula={() => {
                        const formula = chartOf("formula", milk);
                        const current = chartOf("grid", milk);
                        if (!formula || !current) return;
                        patch(current.id, {
                          fatMin: formula.fatMin,
                          fatMax: formula.fatMax,
                          fatStep: formula.fatStep,
                          snfMin: formula.snfMin,
                          snfMax: formula.snfMax,
                          snfStep: formula.snfStep,
                          cells: generateFormulaCells({ ...formula, kind: "formula" }),
                        });
                        setSaved(`${milk} manual chart copied from formula. You can edit any cell.`);
                      }}
                    />
                  ) : null}

                  {item.kind === "fat-only" && milk === "buffalo" && chartOf(item.kind, milk) ? (
                    <RulesEditor chart={chartOf(item.kind, milk)!} onPatch={patch} />
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const KG_FAT_PRESETS = [800, 900, 1000, 1100, 1200];
const PREVIEW_FATS = [5.5, 6, 7, 8];

function FatOnlyEditor({
  chart,
  onPatch,
}: {
  chart?: RateChart;
  onPatch: (id: string, next: Partial<RateChart>) => void;
}) {
  if (!chart) return null;
  const current = chart;
  const kg = resolvedKgFatRate(current);
  const typical = TYPICAL_KG_FAT[milkKey(current.milkType)];
  const perPoint = kg / 100;
  const draft: RateChart = { ...current, kgFatRate: kg, fatRate: perPoint };
  const low = isLowKgFatRate(kg);
  const samples = PREVIEW_FATS.map((fat) => ({ fat, rate: kgFatLitreRate(draft, fat) }));

  function applyKg(nextKg: number, regenerate: boolean) {
    const next: RateChart = { ...current, kgFatRate: nextKg, fatRate: nextKg / 100 };
    onPatch(current.id, {
      kgFatRate: nextKg,
      fatRate: nextKg / 100,
      cells: regenerate ? generateFatOnlyCells(next) : current.cells,
    });
  }

  function generate() {
    onPatch(current.id, { cells: generateFatOnlyCells(draft) });
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="₹ / kg Fat">
          <input
            className={inputClass}
            inputMode="decimal"
            value={kg || ""}
            onChange={(e) => applyKg(Number(e.target.value), false)}
          />
        </Field>
        <Field label="Good SNF min">
          <input
            className={inputClass}
            inputMode="decimal"
            value={chart.goodSnfMin}
            onChange={(e) => onPatch(chart.id, { goodSnfMin: Number(e.target.value) })}
          />
        </Field>
        <Field label="FAT from">
          <input className={inputClass} inputMode="decimal" value={chart.fatMin} onChange={(e) => onPatch(chart.id, { fatMin: Number(e.target.value) })} />
        </Field>
        <Field label="FAT to">
          <input className={inputClass} inputMode="decimal" value={chart.fatMax} onChange={(e) => onPatch(chart.id, { fatMax: Number(e.target.value) })} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {KG_FAT_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
              kg === preset ? "bg-primary text-white" : "bg-[#f4ead6] text-ink hover:bg-[#efe4cc]"
            }`}
            onClick={() => applyKg(preset, true)}
          >
            ₹{preset}
          </button>
        ))}
      </div>

      {low ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-950">
          ₹{kg} / kg Fat se 6% FAT sirf {formatInr(kgFatLitreRate(draft, 6))} / L padega — ye dairy rate nahi hai.
          <button type="button" className="ml-2 font-semibold text-primary underline" onClick={() => applyKg(typical, true)}>
            Typical ₹{typical} use karo
          </button>
        </div>
      ) : (
        <p className="text-[13px] text-muted">
          1% FAT = {formatInr(perPoint)} / L. Collection: FAT% × {formatInr(perPoint)}. SNF optional — deduction tabhi jab SNF daali ho.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {samples.map((row) => (
          <div key={row.fat} className="rounded-xl border border-line bg-[#fbf7ef] px-3 py-2">
            <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">{row.fat.toFixed(1)}% FAT</p>
            <p className="font-display text-lg leading-tight">{formatInr(row.rate)}</p>
            <p className="text-[11px] text-muted">per litre</p>
          </div>
        ))}
      </div>

      <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={generate}>
        Generate {chart.milkType} FAT chart
      </button>
      {chart.cells.length ? (
        <div className="table-scroll max-h-72 rounded-xl border border-line">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead className="table-head sticky top-0 text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">FAT %</th>
                <th className="px-3 py-2 font-medium">Rate / L</th>
              </tr>
            </thead>
            <tbody>
              {chart.cells.map((cell, i) => (
                <tr key={`${cell.fat}-${i}`} className="border-t border-line/70">
                  <td className="px-3 py-1.5 font-medium">{cell.fat.toFixed(1)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-muted">₹</span>
                      <input
                        className="w-full min-w-0 max-w-36 rounded-lg border border-line bg-[#fbf7ef] px-2 py-2 text-base sm:py-1 sm:text-sm"
                        inputMode="decimal"
                        value={cell.rate}
                        onChange={(e) => {
                          const cells = chart.cells.map((row, idx) => (idx === i ? { ...row, rate: Number(e.target.value) } : row));
                          onPatch(chart.id, { cells });
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">Not set yet for {chart.milkType}. Generate to create the FAT table.</p>
      )}
    </div>
  );
}

function sameFat(a: number, b: number) {
  return Math.abs(a - b) < 0.001;
}

function FatRowEditor({
  chart,
  onPatch,
}: {
  chart?: RateChart;
  onPatch: (id: string, next: Partial<RateChart>) => void;
}) {
  const [fat, setFat] = useState("");
  const [rate, setRate] = useState("");
  const [editFat, setEditFat] = useState<number | null>(null);
  const [error, setError] = useState("");

  if (!chart) return null;
  const current = chart;
  const rows = [...current.cells].sort((a, b) => a.fat - b.fat);

  function clear() {
    setFat("");
    setRate("");
    setEditFat(null);
    setError("");
  }

  function save(mode: "add" | "update") {
    const nextFat = round2(Number(fat));
    const nextRate = round2(Number(rate));
    if (!nextFat || Number.isNaN(nextRate)) {
      setError("FAT aur Rate dono chahiye.");
      return;
    }
    const match = current.cells.find((c) => sameFat(c.fat, nextFat));
    if (mode === "add" && match) {
      setError("Is FAT ka rate pehle se hai. Update use karo.");
      return;
    }
    if (mode === "update") {
      if (editFat == null && !match) {
        setError("Pehle table se row choose karo, phir Update dabao.");
        return;
      }
    }
    const replace = editFat ?? nextFat;
    const others = current.cells.filter((c) => !sameFat(c.fat, replace) && !sameFat(c.fat, nextFat));
    onPatch(current.id, {
      cells: [...others, { fat: nextFat, snf: current.goodSnfMin || 0, rate: nextRate }],
    });
    clear();
  }

  return (
    <div className="min-w-0 space-y-4">
      <p className="text-[13px] text-muted sm:text-sm">
        Har FAT% ka apna rate. Naya FAT Add karo, purana row Update karo.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="FAT %">
          <input className={inputClass} inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="3.5" />
        </Field>
        <Field label="Rate / L">
          <input className={inputClass} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="38.65" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={() => save("add")}>
          Add
        </button>
        <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={() => save("update")}>
          Update
        </button>
        {editFat != null ? (
          <button type="button" className={`${btnGhost} col-span-2 w-full sm:col-auto sm:w-auto`} onClick={clear}>
            Cancel
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {rows.length ? (
        <>
          <div className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line md:hidden">
            {rows.map((cell) => (
              <div
                key={cell.fat}
                className={`flex items-center gap-3 px-3 py-3 ${editFat != null && sameFat(editFat, cell.fat) ? "bg-emerald-50" : "bg-card"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted">FAT {cell.fat.toFixed(2)}</p>
                  <p className="font-semibold">{formatInr(cell.rate)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    className="min-h-11 rounded-xl border border-line px-3 text-[12px] font-semibold text-primary"
                    onClick={() => {
                      setFat(String(cell.fat));
                      setRate(String(cell.rate));
                      setEditFat(cell.fat);
                      setError("");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-3 text-[12px] font-semibold text-danger"
                    onClick={() => {
                      onPatch(current.id, { cells: current.cells.filter((c) => !sameFat(c.fat, cell.fat)) });
                      if (editFat != null && sameFat(editFat, cell.fat)) clear();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="table-scroll hidden max-h-80 rounded-xl border border-line md:block">
            <table className="w-full text-left text-sm">
              <thead className="table-head sticky top-0 text-[10px] tracking-wider text-muted uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">FAT %</th>
                  <th className="px-3 py-2 font-medium">Rate / L</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((cell) => (
                  <tr
                    key={cell.fat}
                    className={`border-t border-line/70 ${editFat != null && sameFat(editFat, cell.fat) ? "bg-emerald-50" : ""}`}
                  >
                    <td className="px-3 py-1.5">{cell.fat.toFixed(2)}</td>
                    <td className="px-3 py-1.5">{formatInr(cell.rate)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        className="mr-2 text-[12px] font-semibold text-primary"
                        onClick={() => {
                          setFat(String(cell.fat));
                          setRate(String(cell.rate));
                          setEditFat(cell.fat);
                          setError("");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-danger"
                        onClick={() => {
                          onPatch(current.id, { cells: current.cells.filter((c) => !sameFat(c.fat, cell.fat)) });
                          if (editFat != null && sameFat(editFat, cell.fat)) clear();
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Abhi koi FAT rate nahi. FAT aur Rate daal ke Add karo.</p>
      )}
    </div>
  );
}

function RulesEditor({
  chart,
  onPatch,
}: {
  chart: RateChart;
  onPatch: (id: string, next: Partial<RateChart>) => void;
}) {
  const milk = milkKey(chart.milkType);
  const rules = chart.rules ?? [];

  function setRule(index: number, next: Partial<QualityRule>) {
    onPatch(chart.id, { rules: rules.map((r, i) => (i === index ? { ...r, ...next } : r)) });
  }

  return (
    <div className="mt-6 space-y-3 border-t border-line pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-lg leading-none">Quality deductions</p>
          <p className="mt-1 text-[12px] text-muted">First matching rule wins. 100 = full rate, 0 = reject. SNF rule tabhi lagegi jab collection pe SNF daali ho.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={() => onPatch(chart.id, { rules: defaultRules(milk) })}>
            Load Excel
          </button>
          <button
            type="button"
            className={`${btnGhost} w-full sm:w-auto`}
            onClick={() =>
              onPatch(chart.id, {
                rules: [
                  ...rules,
                  {
                    id: `rule-${crypto.randomUUID().slice(0, 8)}`,
                    label: "New rule",
                    fatMin: null,
                    fatMax: null,
                    snfMin: null,
                    snfMax: null,
                    payPercent: 100,
                  },
                ],
              })
            }
          >
            Add rule
          </button>
        </div>
      </div>
      {rules.length === 0 ? (
        <p className="text-sm text-muted">No deductions. Good milk pays 100%.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <div key={rule.id} className="rounded-xl border border-line bg-[#fbf7ef] p-3">
              <input
                className={`${inputClass} mb-2`}
                value={rule.label}
                onChange={(e) => setRule(i, { label: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <BoundField label="FAT min" value={rule.fatMin} onChange={(fatMin) => setRule(i, { fatMin })} />
                <BoundField label="FAT max" value={rule.fatMax} onChange={(fatMax) => setRule(i, { fatMax })} />
                <BoundField label="SNF min" value={rule.snfMin} onChange={(snfMin) => setRule(i, { snfMin })} />
                <BoundField label="SNF max" value={rule.snfMax} onChange={(snfMax) => setRule(i, { snfMax })} />
                <Field label="Pay %">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={rule.payPercent}
                    onChange={(e) => setRule(i, { payPercent: Number(e.target.value) })}
                  />
                </Field>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="h-11 w-full rounded-xl border border-line text-sm text-danger"
                    onClick={() => onPatch(chart.id, { rules: rules.filter((_, idx) => idx !== i) })}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BoundField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field label={label}>
      <input
        className={inputClass}
        inputMode="decimal"
        placeholder="any"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </Field>
  );
}

function ManualEditor({
  chart,
  fatPage,
  onFatPage,
  onPatch,
  onGenerateBlank,
  onCopyFormula,
}: {
  chart?: RateChart;
  fatPage: number;
  onFatPage: (page: number) => void;
  onPatch: (id: string, next: Partial<RateChart>) => void;
  onGenerateBlank: () => void;
  onCopyFormula: () => void;
}) {
  const pageSize = 8;
  const fats = useMemo(() => (chart ? chartAxes(chart).fats : []), [chart]);
  const snfs = useMemo(() => (chart ? chartAxes(chart).snfs : []), [chart]);
  if (!chart) return null;
  const current = chart;

  const pages = Math.max(1, Math.ceil(fats.length / pageSize));
  const page = Math.min(fatPage, pages - 1);
  const visibleFats = fats.slice(page * pageSize, page * pageSize + pageSize);
  const rateAt = (fat: number, snf: number) => current.cells.find((c) => c.fat === fat && c.snf === snf)?.rate ?? 0;

  function setCell(fat: number, snf: number, rate: number) {
    const others = current.cells.filter((c) => !(c.fat === fat && c.snf === snf));
    onPatch(current.id, { cells: [...others, { fat, snf, rate }] });
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row">
        <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={onGenerateBlank}>
          Create blank {current.milkType} grid
        </button>
        <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={onCopyFormula}>
          Copy from formula
        </button>
      </div>
      {!current.cells.length ? (
        <p className="text-sm text-muted">Not set. Create a blank grid or copy the formula chart, then type rates.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center sm:order-2 sm:text-left">
              FAT {visibleFats[0]?.toFixed(1)} – {visibleFats.at(-1)?.toFixed(1)} · {current.cells.length} cells
            </p>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <button type="button" className={`${btnGhost} w-full sm:order-1 sm:w-auto`} disabled={page <= 0} onClick={() => onFatPage(page - 1)}>
                Prev FAT
              </button>
              <button type="button" className={`${btnGhost} w-full sm:order-3 sm:w-auto`} disabled={page >= pages - 1} onClick={() => onFatPage(page + 1)}>
                Next FAT
              </button>
            </div>
          </div>
          <div className="table-scroll max-h-[min(420px,60vh)] rounded-xl border border-line">
            <table className="min-w-max text-left text-[11px]">
              <thead className="table-head sticky top-0">
                <tr>
                  <th className="sticky left-0 z-10 bg-[#f7f1e6] px-2 py-2 font-medium">FAT \\ SNF</th>
                  {snfs.map((snf) => (
                    <th key={snf} className="px-1 py-2 font-medium">
                      {snf.toFixed(1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleFats.map((fat) => (
                  <tr key={fat} className="border-t border-line/70">
                    <td className="sticky left-0 bg-card px-2 py-1 font-semibold">{fat.toFixed(1)}</td>
                    {snfs.map((snf) => (
                      <td key={`${fat}-${snf}`} className="px-1 py-1">
                        <input
                          className="w-16 rounded-md border border-line bg-[#fbf7ef] px-1 py-1 text-[11px]"
                          inputMode="decimal"
                          value={rateAt(fat, snf)}
                          onChange={(e) => setCell(fat, snf, Number(e.target.value))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

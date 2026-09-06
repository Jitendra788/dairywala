"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Calculator, ChevronDown, Droplets, SlidersHorizontal } from "lucide-react";
import {
  chartAxes,
  generateBlankGrid,
  generateFatOnlyCells,
  generateFormulaCells,
  METHOD_LABEL,
  methodRowCount,
  milkKey,
} from "@/lib/rate";
import { formatInr } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Card, Field, inputClass, PageHeader } from "@/components/ui";
import type { ChartMethod, MilkType, RateChart } from "@/lib/types";

const METHODS: {
  kind: ChartMethod;
  icon: ReactNode;
  hint: string;
}[] = [
  {
    kind: "fat-only",
    icon: <Droplets size={18} />,
    hint: "Single ₹/L rate from buying FAT%. Cow and Buffalo charts stay separate.",
  },
  {
    kind: "formula",
    icon: <Calculator size={18} />,
    hint: "Generate Cow & Buffalo charts from a FAT + SNF formula.",
  },
  {
    kind: "grid",
    icon: <SlidersHorizontal size={18} />,
    hint: "Type per-cell rates into Cow & Buffalo charts.",
  },
];

export function RateChartsView() {
  const dairy = useDairy();
  const [open, setOpen] = useState<ChartMethod | null>(dairy.settings.rateMethod);
  const [milk, setMilk] = useState<MilkType>("cow");
  const [fatPage, setFatPage] = useState(0);
  const [saved, setSaved] = useState("");

  const method = dairy.settings.rateMethod;

  function chartOf(kind: ChartMethod, milkType: MilkType) {
    return dairy.charts.find((c) => c.kind === kind && milkKey(c.milkType) === milkType);
  }

  function patch(id: string, next: Partial<RateChart>) {
    dairy.saveCharts(dairy.charts.map((c) => (c.id === id ? { ...c, ...next } : c)));
    setSaved("");
  }

  function useMethod(kind: ChartMethod) {
    dairy.updateSettings({ rateMethod: kind });
    setOpen(kind);
    setSaved(`${METHOD_LABEL[kind]} is now used in collection.`);
  }

  function badge(kind: ChartMethod) {
    const cow = methodRowCount(dairy.charts, kind, "cow");
    const buffalo = methodRowCount(dairy.charts, kind, "buffalo");
    if (!cow && !buffalo) return "Not set";
    return `${cow} cow • ${buffalo} buffalo rows`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        kicker="रेट चार्ट"
        title="Create rate chart"
        hint="Choose how you price milk from farmers — by FAT, by formula, or with a custom SNF / FAT chart. Collection uses only one method at a time."
      />

      {saved ? <p className="text-sm font-medium text-primary">{saved}</p> : null}

      <div className="space-y-3">
        {METHODS.map((item) => {
          const selected = method === item.kind;
          const expanded = open === item.kind;
          const ready = badge(item.kind) !== "Not set";
          return (
            <Card key={item.kind} className="overflow-hidden p-0">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-4 text-left"
                onClick={() => setOpen(expanded ? null : item.kind)}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-primary">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg leading-none">{METHOD_LABEL[item.kind]}</span>
                    {selected ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                        In use
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[13px] text-muted">{item.hint}</span>
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
                <div className="border-t border-line px-4 py-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:hidden">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ready ? "bg-emerald-50 text-primary" : "bg-[#f4ead6] text-muted"}`}>
                      {badge(item.kind)}
                    </span>
                  </div>
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex rounded-xl bg-[#f4ead6] p-0.5">
                      {(["cow", "buffalo"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`flex-1 rounded-[10px] px-3 py-1.5 text-[12px] font-semibold capitalize sm:flex-none ${
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
                    <button
                      type="button"
                      className={selected ? btnGhost : btnPrimary}
                      onClick={() => useMethod(item.kind)}
                    >
                      {selected ? "Using this method" : "Use this method"}
                    </button>
                  </div>

                  {item.kind === "fat-only" ? (
                    <FatOnlyEditor chart={chartOf("fat-only", milk)} onPatch={patch} />
                  ) : null}
                  {item.kind === "formula" ? (
                    <FormulaEditor
                      chart={chartOf("formula", milk)}
                      onPatch={patch}
                      onGenerate={() => {
                        const next = dairy.charts.map((c) =>
                          c.kind === "formula" ? { ...c, cells: generateFormulaCells(c) } : c,
                        );
                        dairy.saveCharts(next);
                        setSaved("Cow and Buffalo formula charts generated.");
                      }}
                    />
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
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FatOnlyEditor({
  chart,
  onPatch,
}: {
  chart?: RateChart;
  onPatch: (id: string, next: Partial<RateChart>) => void;
}) {
  if (!chart) return null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="₹ per FAT %">
          <input className={inputClass} inputMode="decimal" value={chart.fatRate} onChange={(e) => onPatch(chart.id, { fatRate: Number(e.target.value), cells: [] })} />
        </Field>
        <Field label="Base">
          <input className={inputClass} inputMode="decimal" value={chart.base} onChange={(e) => onPatch(chart.id, { base: Number(e.target.value), cells: [] })} />
        </Field>
        <Field label="FAT from">
          <input className={inputClass} inputMode="decimal" value={chart.fatMin} onChange={(e) => onPatch(chart.id, { fatMin: Number(e.target.value), cells: [] })} />
        </Field>
        <Field label="FAT to">
          <input className={inputClass} inputMode="decimal" value={chart.fatMax} onChange={(e) => onPatch(chart.id, { fatMax: Number(e.target.value), cells: [] })} />
        </Field>
      </div>
      <p className="text-sm text-muted">
        Rate / L = FAT × {chart.fatRate} + {chart.base}. Example 6.0% = {formatInr(6 * chart.fatRate + chart.base)}
      </p>
      <button
        type="button"
        className={btnPrimary}
        onClick={() => onPatch(chart.id, { cells: generateFatOnlyCells(chart) })}
      >
        Generate {chart.milkType} FAT chart
      </button>
      {chart.cells.length ? (
        <div className="table-scroll max-h-72 rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="table-head sticky top-0 text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">FAT %</th>
                <th className="px-3 py-2 font-medium">Rate / L</th>
              </tr>
            </thead>
            <tbody>
              {chart.cells.map((cell, i) => (
                <tr key={`${cell.fat}-${i}`} className="border-t border-line/70">
                  <td className="px-3 py-1.5">{cell.fat.toFixed(1)}</td>
                  <td className="px-3 py-1.5">
                    <input
                      className="w-28 rounded-lg border border-line bg-[#fbf7ef] px-2 py-1 text-sm"
                      inputMode="decimal"
                      value={cell.rate}
                      onChange={(e) => {
                        const cells = chart.cells.map((row, idx) => (idx === i ? { ...row, rate: Number(e.target.value) } : row));
                        onPatch(chart.id, { cells });
                      }}
                    />
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

function FormulaEditor({
  chart,
  onPatch,
  onGenerate,
}: {
  chart?: RateChart;
  onPatch: (id: string, next: Partial<RateChart>) => void;
  onGenerate: () => void;
}) {
  if (!chart) return null;
  const { fats, snfs } = chartAxes(chart);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="FAT ×">
          <input className={inputClass} inputMode="decimal" value={chart.fatCoeff} onChange={(e) => onPatch(chart.id, { fatCoeff: Number(e.target.value) })} />
        </Field>
        <Field label="SNF ×">
          <input className={inputClass} inputMode="decimal" value={chart.snfCoeff} onChange={(e) => onPatch(chart.id, { snfCoeff: Number(e.target.value) })} />
        </Field>
        <Field label="Base">
          <input className={inputClass} inputMode="decimal" value={chart.base} onChange={(e) => onPatch(chart.id, { base: Number(e.target.value) })} />
        </Field>
        <Field label="FAT from / to">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} inputMode="decimal" value={chart.fatMin} onChange={(e) => onPatch(chart.id, { fatMin: Number(e.target.value) })} />
            <input className={inputClass} inputMode="decimal" value={chart.fatMax} onChange={(e) => onPatch(chart.id, { fatMax: Number(e.target.value) })} />
          </div>
        </Field>
        <Field label="SNF from / to">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputClass} inputMode="decimal" value={chart.snfMin} onChange={(e) => onPatch(chart.id, { snfMin: Number(e.target.value) })} />
            <input className={inputClass} inputMode="decimal" value={chart.snfMax} onChange={(e) => onPatch(chart.id, { snfMax: Number(e.target.value) })} />
          </div>
        </Field>
        <Field label="Step">
          <input className={inputClass} inputMode="decimal" value={chart.fatStep} onChange={(e) => onPatch(chart.id, { fatStep: Number(e.target.value), snfStep: Number(e.target.value) })} />
        </Field>
      </div>
      <p className="text-sm text-muted">
        Rate = FAT × {chart.fatCoeff} + SNF × {chart.snfCoeff} + {chart.base}. This {chart.milkType} grid will be {fats.length * snfs.length} rows.
      </p>
      <button type="button" className={btnPrimary} onClick={onGenerate}>
        Generate Cow & Buffalo charts
      </button>
      {chart.cells.length ? (
        <p className="text-sm font-medium text-primary">{chart.cells.length} {chart.milkType} rows saved. Collection uses this method only when it is marked In use.</p>
      ) : (
        <p className="text-sm text-muted">Not set. Generate to build the Cow and Buffalo formula tables.</p>
      )}
    </div>
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

  const pages = Math.max(1, Math.ceil(fats.length / pageSize));
  const page = Math.min(fatPage, pages - 1);
  const visibleFats = fats.slice(page * pageSize, page * pageSize + pageSize);
  const rateAt = (fat: number, snf: number) => chart.cells.find((c) => c.fat === fat && c.snf === snf)?.rate ?? 0;

  function setCell(fat: number, snf: number, rate: number) {
    const others = chart.cells.filter((c) => !(c.fat === fat && c.snf === snf));
    onPatch(chart.id, { cells: [...others, { fat, snf, rate }] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className={btnGhost} onClick={onGenerateBlank}>
          Create blank {chart.milkType} grid
        </button>
        <button type="button" className={btnGhost} onClick={onCopyFormula}>
          Copy from formula
        </button>
      </div>
      {!chart.cells.length ? (
        <p className="text-sm text-muted">Not set. Create a blank grid or copy the formula chart, then type rates.</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-[12px] text-muted">
            <button type="button" className={btnGhost} disabled={page <= 0} onClick={() => onFatPage(page - 1)}>
              Prev FAT
            </button>
            <span>
              FAT {visibleFats[0]?.toFixed(1)} – {visibleFats.at(-1)?.toFixed(1)} · {chart.cells.length} cells
            </span>
            <button type="button" className={btnGhost} disabled={page >= pages - 1} onClick={() => onFatPage(page + 1)}>
              Next FAT
            </button>
          </div>
          <div className="table-scroll max-h-[420px] rounded-xl border border-line">
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

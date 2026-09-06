"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Calculator, ChevronDown, Droplets, SlidersHorizontal } from "lucide-react";
import {
  applyStandardSheet,
  chartAxes,
  defaultRules,
  formulaRate,
  generateBlankGrid,
  generateFatOnlyCells,
  generateFormulaCells,
  kgFatLitreRate,
  METHOD_LABEL,
  methodRowCount,
  milkKey,
  removeFatCell,
  upsertFatCell,
} from "@/lib/rate";
import { formatInr } from "@/lib/money";
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
    hint: "Buffalo Excel sheet: ₹ / kg Fat. Rate/L = FAT% × (₹/kg Fat ÷ 100). SNF deductions apply on top.",
  },
  {
    kind: "formula",
    icon: <Calculator size={18} />,
    hint: "Cow Excel sheet: har FAT ka alag rate. Formula se generate karo, phir Add / Update se badlo.",
  },
  {
    kind: "grid",
    icon: <SlidersHorizontal size={18} />,
    hint: "Type your own SNF × FAT cell rates if the Excel formulas are not enough.",
  },
];

export function RateChartsView() {
  const dairy = useDairy();
  const [open, setOpen] = useState<ChartMethod | null>(dairy.settings.cowMethod ?? dairy.settings.rateMethod);
  const [milk, setMilk] = useState<MilkType>("buffalo");
  const [fatPage, setFatPage] = useState(0);
  const [saved, setSaved] = useState("");

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

  function applyExcelSheet() {
    const next = dairy.charts.map((c) => {
      const type = milkKey(c.milkType);
      if (c.kind === "fat-only" && type === "buffalo") return { ...applyStandardSheet(c), id: c.id };
      if (c.kind === "formula" && type === "cow") return { ...applyStandardSheet(c), id: c.id };
      return c;
    });
    dairy.saveCharts(next);
    dairy.updateSettings({ cowMethod: "formula", buffaloMethod: "fat-only", rateMethod: "formula" });
    setOpen("fat-only");
    setMilk("buffalo");
    setSaved("Excel sheet applied: Buffalo ₹900/kg Fat, Cow 421.69 EFU, with SNF deductions.");
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
        hint="Cow and Buffalo use different sheets at the same time — like your Excel: Buffalo ₹/kg Fat, Cow EFU."
      />

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg leading-none">Excel rate sheet</p>
          <p className="mt-1 text-[13px] text-muted">
            Effective 21-08-2026. Buffalo ₹900/kg Fat (5.1–10.0%). Cow 421.69 EFU (FAT 3.0–5.0, SNF 8.5+).
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={applyExcelSheet}>
          Apply Excel sheet
        </button>
      </Card>

      {saved ? <p className="text-sm font-medium text-primary">{saved}</p> : null}

      <div className="space-y-3">
        {METHODS.map((item) => {
          const using = usedBy(item.kind);
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
                    {using ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                        {using}
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
                      {(["buffalo", "cow"] as const).map((m) => (
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={usedBy(item.kind) === "Cow" || usedBy(item.kind) === "Cow + Buffalo" ? btnGhost : btnPrimary}
                        onClick={() => useFor(item.kind, "cow")}
                      >
                        Use for Cow
                      </button>
                      <button
                        type="button"
                        className={usedBy(item.kind) === "Buffalo" || usedBy(item.kind) === "Cow + Buffalo" ? btnGhost : btnPrimary}
                        onClick={() => useFor(item.kind, "buffalo")}
                      >
                        Use for Buffalo
                      </button>
                    </div>
                  </div>

                  {item.kind === "fat-only" ? (
                    <FatOnlyEditor chart={chartOf("fat-only", milk)} onPatch={patch} />
                  ) : null}
                  {item.kind === "formula" ? (
                    <FormulaEditor
                      chart={chartOf("formula", milk)}
                      onPatch={patch}
                      onGenerate={() => {
                        const current = chartOf("formula", milk);
                        if (!current) return;
                        patch(current.id, { cells: generateFormulaCells(current) });
                        setSaved(`${milk} EFU / formula chart generated.`);
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

                  {chartOf(item.kind, milk) ? (
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

function parseDecimalDraft(raw: string): number | "draft" | null {
  const text = raw.replace(",", ".").trim();
  if (text === "") return null;
  if (text === "-" || text === "." || text === "-." || /\.$/.test(text)) return "draft";
  const n = Number(text);
  return Number.isNaN(n) ? "draft" : n;
}

function DecimalInput({
  value,
  onValue,
  className = inputClass,
  placeholder,
  emptyAsNull = false,
}: {
  value: number | null | undefined;
  onValue: (n: number | null) => void;
  className?: string;
  placeholder?: string;
  emptyAsNull?: boolean;
}) {
  const shown = value == null ? "" : String(value);
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(shown);
  }, [shown, focused]);

  function commit(raw: string) {
    const parsed = parseDecimalDraft(raw);
    if (parsed === "draft") return;
    if (parsed === null) {
      if (emptyAsNull) onValue(null);
      return;
    }
    onValue(parsed);
  }

  return (
    <input
      className={className}
      inputMode="decimal"
      placeholder={placeholder}
      value={focused ? text : shown}
      onFocus={() => {
        setFocused(true);
        setText(shown);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        commit(raw);
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseDecimalDraft(text);
        if (parsed === "draft" || parsed === null) {
          onValue(emptyAsNull ? null : value ?? 0);
          return;
        }
        onValue(parsed);
      }}
    />
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
  const kg = chart.kgFatRate || chart.fatRate * 100 || 0;
  const example = kgFatLitreRate({ ...chart, kgFatRate: kg }, 6);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="₹ / kg Fat">
          <DecimalInput
            value={kg || null}
            emptyAsNull
            onValue={(n) => {
              const kgFatRate = n ?? 0;
              onPatch(chart.id, { kgFatRate, fatRate: kgFatRate / 100, cells: [] });
            }}
          />
        </Field>
        <Field label="Good SNF min">
          <DecimalInput value={chart.goodSnfMin} onValue={(n) => onPatch(chart.id, { goodSnfMin: n ?? 0, cells: [] })} />
        </Field>
        <Field label="FAT from">
          <DecimalInput value={chart.fatMin} onValue={(n) => onPatch(chart.id, { fatMin: n ?? 0, cells: [] })} />
        </Field>
        <Field label="FAT to">
          <DecimalInput value={chart.fatMax} onValue={(n) => onPatch(chart.id, { fatMax: n ?? 0, cells: [] })} />
        </Field>
      </div>
      <p className="text-sm text-muted">
        Rate / L = FAT% × {(kg / 100).toFixed(2)}. Example 6.0% FAT = {formatInr(example)}. Good milk needs SNF {chart.goodSnfMin}+.
      </p>
      <button type="button" className={btnPrimary} onClick={() => onPatch(chart.id, { cells: generateFatOnlyCells({ ...chart, kgFatRate: kg, fatRate: kg / 100 }) })}>
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
                    <DecimalInput
                      className="w-28 rounded-lg border border-line bg-[#fbf7ef] px-2 py-1 text-sm"
                      value={cell.rate}
                      onValue={(n) => {
                        const cells = chart.cells.map((row, idx) => (idx === i ? { ...row, rate: n ?? 0 } : row));
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
  const [fatInput, setFatInput] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [note, setNote] = useState("");
  if (!chart) return null;
  const goodSnf = chart.goodSnfMin || chart.snfMin;
  const sample = formulaRate(chart, chart.milkType === "cow" ? 4 : 6, goodSnf);
  const fatValue = Number(fatInput);
  const existing = fatValue
    ? chart.cells.find((c) => Math.abs(c.fat - fatValue) < 0.001)
    : undefined;
  const isUpdate = Boolean(existing);

  function saveFatRow() {
    if (!chart || !fatValue) {
      setNote("FAT % daalo.");
      return;
    }
    const rate = Number(rateInput) || formulaRate(chart, fatValue, goodSnf);
    onPatch(chart.id, { cells: upsertFatCell(chart.cells, fatValue, rate, goodSnf) });
    setNote(isUpdate ? `FAT ${fatValue.toFixed(2)} ka rate update ho gaya.` : `FAT ${fatValue.toFixed(2)} add ho gaya.`);
    setFatInput("");
    setRateInput("");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="EFU rate">
          <DecimalInput value={chart.efuRate || null} emptyAsNull onValue={(n) => onPatch(chart.id, { efuRate: n ?? 0 })} />
        </Field>
        <Field label="SNF × factor">
          <DecimalInput value={chart.snfEfuFactor || null} emptyAsNull onValue={(n) => onPatch(chart.id, { snfEfuFactor: n ?? 0 })} />
        </Field>
        <Field label="Good SNF min">
          <DecimalInput value={chart.goodSnfMin} onValue={(n) => onPatch(chart.id, { goodSnfMin: n ?? 0 })} />
        </Field>
        <Field label="FAT from / to">
          <div className="grid grid-cols-2 gap-2">
            <DecimalInput value={chart.fatMin} onValue={(n) => onPatch(chart.id, { fatMin: n ?? 0 })} />
            <DecimalInput value={chart.fatMax} onValue={(n) => onPatch(chart.id, { fatMax: n ?? 0 })} />
          </div>
        </Field>
        <Field label="SNF from / to">
          <div className="grid grid-cols-2 gap-2">
            <DecimalInput value={chart.snfMin} onValue={(n) => onPatch(chart.id, { snfMin: n ?? 0 })} />
            <DecimalInput value={chart.snfMax} onValue={(n) => onPatch(chart.id, { snfMax: n ?? 0 })} />
          </div>
        </Field>
        <Field label="Step">
          <DecimalInput value={chart.fatStep} onValue={(n) => onPatch(chart.id, { fatStep: n ?? 0.1, snfStep: n ?? 0.1 })} />
        </Field>
      </div>
      {chart.efuRate > 0 ? (
        <p className="text-sm text-muted">
          Rate / L = (FAT + SNF × {chart.snfEfuFactor || 2 / 3}) × {chart.efuRate} ÷ 100. At SNF {goodSnf},
          {chart.milkType === "cow" ? " 4.0% FAT" : " 6.0% FAT"} = {formatInr(sample)}.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="FAT ×">
            <DecimalInput value={chart.fatCoeff} onValue={(n) => onPatch(chart.id, { fatCoeff: n ?? 0 })} />
          </Field>
          <Field label="SNF ×">
            <DecimalInput value={chart.snfCoeff} onValue={(n) => onPatch(chart.id, { snfCoeff: n ?? 0 })} />
          </Field>
          <Field label="Base">
            <DecimalInput value={chart.base} onValue={(n) => onPatch(chart.id, { base: n ?? 0 })} />
          </Field>
        </div>
      )}
      <button type="button" className={btnPrimary} onClick={onGenerate}>
        Generate {chart.milkType} chart
      </button>

      <div className="rounded-2xl border border-line bg-[#fbf7ef] p-3">
        <p className="font-display text-lg leading-none">Add / update FAT rate</p>
        <p className="mt-1 text-[12px] text-muted">Naya FAT add karo, ya wahi FAT daal ke rate update karo. Collection isi table se rate lega.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="FAT %">
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="3.20"
              value={fatInput}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
                setFatInput(raw);
                setNote("");
              }}
              onBlur={() => {
                if (existing && !rateInput) setRateInput(String(existing.rate));
              }}
            />
          </Field>
          <Field label="Rate / L">
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder={fatValue ? String(formulaRate(chart, fatValue, goodSnf)) : "40.76"}
              value={rateInput}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
                setRateInput(raw);
              }}
            />
          </Field>
          <div className="flex items-end">
            <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={saveFatRow}>
              {isUpdate ? "Update" : "Add"}
            </button>
          </div>
        </div>
        {note ? <p className="mt-2 text-sm font-medium text-primary">{note}</p> : null}
      </div>

      {chart.cells.length ? (
        <div className="table-scroll max-h-80 rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="table-head sticky top-0 text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">FAT %</th>
                <th className="px-3 py-2 font-medium">SNF %</th>
                <th className="px-3 py-2 font-medium">Rate / L</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {chart.cells.map((cell) => (
                <tr key={`${cell.fat}-${cell.snf}`} className="border-t border-line/70">
                  <td className="px-3 py-1.5">{cell.fat.toFixed(2)}</td>
                  <td className="px-3 py-1.5">{cell.snf.toFixed(1)}</td>
                  <td className="px-3 py-1.5">
                    <DecimalInput
                      className="w-28 rounded-lg border border-line bg-[#fbf7ef] px-2 py-1 text-sm"
                      value={cell.rate}
                      onValue={(n) => onPatch(chart.id, { cells: upsertFatCell(chart.cells, cell.fat, n ?? 0, cell.snf) })}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      className="text-xs font-semibold text-danger"
                      onClick={() => {
                        onPatch(chart.id, { cells: removeFatCell(chart.cells, cell.fat) });
                        setNote(`FAT ${cell.fat.toFixed(2)} hata diya.`);
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
      ) : (
        <p className="text-sm text-muted">Abhi koi FAT row nahi. Generate karo, ya upar se Add karo.</p>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg leading-none">Quality deductions</p>
          <p className="mt-1 text-[12px] text-muted">First matching rule wins. 100 = full rate, 0 = reject / no payment.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={() => onPatch(chart.id, { rules: defaultRules(milk) })}>
            Load Excel deductions
          </button>
          <button
            type="button"
            className={btnGhost}
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <BoundField label="FAT min" value={rule.fatMin} onChange={(fatMin) => setRule(i, { fatMin })} />
                <BoundField label="FAT max" value={rule.fatMax} onChange={(fatMax) => setRule(i, { fatMax })} />
                <BoundField label="SNF min" value={rule.snfMin} onChange={(snfMin) => setRule(i, { snfMin })} />
                <BoundField label="SNF max" value={rule.snfMax} onChange={(snfMax) => setRule(i, { snfMax })} />
                <Field label="Pay %">
                  <DecimalInput value={rule.payPercent} onValue={(n) => setRule(i, { payPercent: n ?? 0 })} />
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
      <DecimalInput value={value} emptyAsNull placeholder="any" onValue={onChange} />
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
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className={btnGhost} onClick={onGenerateBlank}>
          Create blank {current.milkType} grid
        </button>
        <button type="button" className={btnGhost} onClick={onCopyFormula}>
          Copy from formula
        </button>
      </div>
      {!current.cells.length ? (
        <p className="text-sm text-muted">Not set. Create a blank grid or copy the formula chart, then type rates.</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-[12px] text-muted">
            <button type="button" className={btnGhost} disabled={page <= 0} onClick={() => onFatPage(page - 1)}>
              Prev FAT
            </button>
            <span>
              FAT {visibleFats[0]?.toFixed(1)} – {visibleFats.at(-1)?.toFixed(1)} · {current.cells.length} cells
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
                        <DecimalInput
                          className="w-16 rounded-md border border-line bg-[#fbf7ef] px-1 py-1 text-[11px]"
                          value={rateAt(fat, snf)}
                          onValue={(n) => setCell(fat, snf, n ?? 0)}
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

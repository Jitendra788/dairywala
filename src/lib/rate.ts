import { round2 } from "@/lib/money";
import type { ChartMethod, MilkType, QualityRule, RateCell, RateChart, Settings } from "@/lib/types";

export const METHOD_LABEL: Record<ChartMethod, string> = {
  "fat-only": "₹ / kg Fat",
  formula: "FAT rate table",
  grid: "Manual SNF × FAT chart",
};

export type RateQuote = {
  base: number;
  rate: number;
  payPercent: number;
  rule: QualityRule | null;
  rejected: boolean;
};

export function milkKey(milkType: MilkType | "all"): MilkType {
  return milkType === "buffalo" ? "buffalo" : "cow";
}

export function methodForMilk(settings: Pick<Settings, "cowMethod" | "buffaloMethod" | "rateMethod">, milkType: MilkType) {
  if (milkType === "buffalo") return settings.buffaloMethod ?? "fat-only";
  return settings.cowMethod ?? "formula";
}

export function defaultRanges(milk: MilkType) {
  if (milk === "buffalo") {
    return { fatMin: 5.1, fatMax: 12.1, fatStep: 0.1, snfMin: 9, snfMax: 11, snfStep: 0.1 };
  }
  return { fatMin: 3, fatMax: 5, fatStep: 0.1, snfMin: 8.5, snfMax: 10, snfStep: 0.1 };
}

export function defaultRules(milk: MilkType): QualityRule[] {
  if (milk === "buffalo") {
    return [
      { id: "b-low-fat", label: "FAT 0.1–5.0 and SNF ≤ 9.0 → 25% of good milk", fatMin: 0.1, fatMax: 5, snfMin: null, snfMax: 9, payPercent: 25 },
      { id: "b-snf-84", label: "SNF 8.4 → 25% of good milk", fatMin: null, fatMax: null, snfMin: 8.4, snfMax: 8.4, payPercent: 25 },
      { id: "b-snf-85", label: "SNF 8.5–8.7 → 4% deduction", fatMin: null, fatMax: null, snfMin: 8.5, snfMax: 8.7, payPercent: 96 },
      { id: "b-snf-88", label: "SNF 8.8–8.9 → 2% deduction", fatMin: null, fatMax: null, snfMin: 8.8, snfMax: 8.9, payPercent: 98 },
    ];
  }
  return [
    { id: "c-snf-80", label: "SNF 8.0 → 25% of EFU rate", fatMin: null, fatMax: null, snfMin: 8, snfMax: 8, payPercent: 25 },
    { id: "c-high-fat", label: "FAT 5.1+ and SNF 8.5+ → 85% of EFU rate", fatMin: 5.1, fatMax: null, snfMin: 8.5, snfMax: null, payPercent: 85 },
    { id: "c-snf-81", label: "SNF 8.1–8.2 → 96% of EFU rate", fatMin: null, fatMax: null, snfMin: 8.1, snfMax: 8.2, payPercent: 96 },
    { id: "c-snf-83", label: "SNF 8.3–8.4 → 98% of EFU rate", fatMin: null, fatMax: null, snfMin: 8.3, snfMax: 8.4, payPercent: 98 },
  ];
}

export function axisValues(min: number, max: number, step: number) {
  const size = Math.max(0.01, step || 0.1);
  const values: number[] = [];
  const last = Math.round((max - min) / size);
  for (let i = 0; i <= last; i++) values.push(round2(min + i * size));
  return values;
}

export function chartAxes(chart: RateChart) {
  return {
    fats: axisValues(chart.fatMin, chart.fatMax, chart.fatStep),
    snfs: axisValues(chart.snfMin, chart.snfMax, chart.snfStep),
  };
}

function nearestCell(cells: RateCell[], fat: number, snf: number, useSnf: boolean) {
  let best = cells[0];
  let dist = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    const d = Math.abs(cell.fat - fat) + (useSnf ? Math.abs(cell.snf - snf) : 0);
    if (d < dist) {
      dist = d;
      best = cell;
    }
  }
  return best;
}

export const TYPICAL_KG_FAT: Record<MilkType, number> = {
  buffalo: 900,
  cow: 700,
};

export function resolvedKgFatRate(chart: Pick<RateChart, "kgFatRate" | "fatRate">) {
  return chart.kgFatRate || chart.fatRate * 100 || 0;
}

/** Desk often types 66 for ₹6.60 / 1% FAT (same as ₹660 / kg Fat). */
export function effectiveKgFatRate(kg: number) {
  if (kg > 0 && kg < 200) return kg * 10;
  return kg;
}

export function fatPointRate(chart: Pick<RateChart, "kgFatRate" | "fatRate">) {
  return effectiveKgFatRate(resolvedKgFatRate(chart)) / 100;
}

/** After 66→660 scaling, warn only if 6% FAT still pays under ₹20 / L. */
export function isLowKgFatRate(kg: number) {
  return kg > 0 && (effectiveKgFatRate(kg) / 100) * 6 < 20;
}

function cellsLookLikeFatEqualsRate(cells: RateCell[]) {
  if (cells.length < 3) return false;
  const hits = cells.filter((c) => Math.abs(c.rate - c.fat) < 0.051).length;
  return hits / cells.length > 0.8;
}

function inferredPointRate(cells: RateCell[]) {
  const sample = cells.filter((c) => c.fat > 0).slice(0, 8);
  if (sample.length < 3) return null;
  const ratios = sample.map((c) => c.rate / c.fat);
  const avg = ratios.reduce((sum, n) => sum + n, 0) / ratios.length;
  return ratios.every((n) => Math.abs(n - avg) < 0.05) ? avg : null;
}

export function kgFatLitreRate(chart: RateChart, fat: number) {
  const perPoint = fatPointRate(chart);
  return round2(fat * perPoint + (chart.base || 0));
}

export function efuLitreRate(chart: RateChart, fat: number, snf: number) {
  const factor = chart.snfEfuFactor || 2 / 3;
  const totalEfu = fat + snf * factor;
  return round2((totalEfu * (chart.efuRate || 0)) / 100);
}

export function formulaRate(chart: RateChart, fat: number, snf: number) {
  if (chart.efuRate > 0) return efuLitreRate(chart, fat, snf);
  return round2(chart.base + fat * chart.fatCoeff + snf * chart.snfCoeff);
}

export function fatOnlyRate(chart: RateChart, fat: number) {
  return kgFatLitreRate(chart, fat);
}

function inBound(value: number, min: number | null, max: number | null) {
  if (min != null && value < min - 0.001) return false;
  if (max != null && value > max + 0.001) return false;
  return true;
}

export function matchQualityRule(rules: QualityRule[] | undefined, fat: number, snf: number) {
  const hasSnf = snf > 0;
  for (const rule of rules ?? []) {
    if (!inBound(fat, rule.fatMin, rule.fatMax)) continue;
    const snfBound = rule.snfMin != null || rule.snfMax != null;
    if (snfBound && !hasSnf) continue;
    if (!inBound(snf, rule.snfMin, rule.snfMax)) continue;
    return rule;
  }
  return null;
}

function baseRate(chart: RateChart, fat: number, snf: number) {
  if (chart.kind === "grid") {
    if (chart.cells.length) return round2(nearestCell(chart.cells, fat, snf, true).rate);
    return formulaRate(chart, fat, snf);
  }
  if (chart.cells.length) {
    return round2(nearestCell(chart.cells, fat, 0, false).rate);
  }
  if (chart.kind === "fat-only") return kgFatLitreRate(chart, fat);
  return formulaRate(chart, fat, snf);
}

export function quoteRate(chart: RateChart | undefined, fat: number, snf: number): RateQuote {
  if (!chart || !fat) {
    return { base: 0, rate: 0, payPercent: 0, rule: null, rejected: true };
  }
  const usedSnf = snf > 0 ? snf : chart.goodSnfMin || 0;
  const base = baseRate(chart, fat, usedSnf);
  const rule = matchQualityRule(chart.rules, fat, snf);
  const payPercent = rule?.payPercent ?? 100;
  return {
    base,
    rate: round2(base * (payPercent / 100)),
    payPercent,
    rule,
    rejected: payPercent === 0,
  };
}

export function lookupRate(chart: RateChart | undefined, fat: number, snf: number) {
  return quoteRate(chart, fat, snf).rate;
}

export function pickChart(charts: RateChart[], milkType: MilkType, method?: ChartMethod) {
  const milk = milkKey(milkType);
  if (method) {
    return (
      charts.find((c) => c.kind === method && milkKey(c.milkType) === milk) ??
      charts.find((c) => c.kind === method) ??
      charts[0]
    );
  }
  return (
    charts.find((c) => c.active && (c.milkType === milk || c.milkType === "all")) ??
    charts.find((c) => c.active) ??
    charts[0]
  );
}

export function generateFatOnlyCells(chart: RateChart): RateCell[] {
  return axisValues(chart.fatMin, chart.fatMax, chart.fatStep).map((fat) => ({
    fat,
    snf: 0,
    rate: kgFatLitreRate(chart, fat),
  }));
}

export function generateFormulaCells(chart: RateChart): RateCell[] {
  const fats = axisValues(chart.fatMin, chart.fatMax, chart.fatStep);
  const goodSnf = chart.goodSnfMin || chart.snfMin;
  return fats.map((fat) => ({
    fat,
    snf: goodSnf,
    rate: formulaRate(chart, fat, goodSnf),
  }));
}

export function generateBlankGrid(chart: RateChart): RateCell[] {
  const { fats, snfs } = chartAxes(chart);
  const cells: RateCell[] = [];
  for (const fat of fats) {
    for (const snf of snfs) {
      cells.push({ fat, snf, rate: 0 });
    }
  }
  return cells;
}

export function methodRowCount(charts: RateChart[], kind: ChartMethod, milk: MilkType) {
  return charts.find((c) => c.kind === kind && milkKey(c.milkType) === milk)?.cells.length ?? 0;
}

export function calcAmount(qty: number, rate: number) {
  return round2(qty * rate);
}

export function defaultChart(kind: ChartMethod, milk: MilkType): RateChart {
  const ranges = defaultRanges(milk);
  const isBuffalo = milk === "buffalo";
  return {
    id: `chart-${kind}-${milk}`,
    name: isBuffalo ? "Buffalo" : "Cow",
    kind,
    milkType: milk,
    fatCoeff: isBuffalo ? 7.35 : 6.85,
    snfCoeff: isBuffalo ? 4.15 : 3.95,
    base: 0,
    fatRate: isBuffalo ? 9 : 0,
    kgFatRate: isBuffalo ? 900 : 0,
    efuRate: isBuffalo ? 0 : 421.69,
    snfEfuFactor: 2 / 3,
    goodSnfMin: isBuffalo ? 9 : 8.5,
    ...ranges,
    cells: [],
    rules: defaultRules(milk),
    active: kind === (isBuffalo ? "fat-only" : "formula"),
  };
}

export function applyStandardSheet(chart: RateChart): RateChart {
  const milk = milkKey(chart.milkType);
  const next = { ...defaultChart(chart.kind, milk), id: chart.id, kind: chart.kind };
  if (chart.kind === "fat-only") next.cells = generateFatOnlyCells(next);
  if (chart.kind === "formula") next.cells = generateFormulaCells(next);
  return next;
}

export function normalizeChart(chart: Partial<RateChart> & Pick<RateChart, "id">): RateChart {
  const kind: ChartMethod = chart.kind === "grid" ? "grid" : chart.kind === "fat-only" ? "fat-only" : "formula";
  const milk = milkKey(chart.milkType ?? "cow");
  const base = defaultChart(kind, milk);
  const kgFatRate = chart.kgFatRate ?? (chart.fatRate ? chart.fatRate * 100 : base.kgFatRate);
  const next: RateChart = {
    ...base,
    ...chart,
    kind,
    milkType: milk,
    cells: chart.cells ?? [],
    rules: chart.rules?.length ? chart.rules : base.rules,
    kgFatRate,
    fatRate: kind === "fat-only" ? fatPointRate({ kgFatRate, fatRate: 0 }) : (chart.fatRate ?? base.fatRate),
    efuRate: chart.efuRate ?? base.efuRate,
    snfEfuFactor: chart.snfEfuFactor ?? base.snfEfuFactor,
    goodSnfMin: chart.goodSnfMin ?? base.goodSnfMin,
    fatMin: chart.fatMin ?? base.fatMin,
    fatMax: milk === "buffalo" ? Math.max(chart.fatMax ?? 0, base.fatMax) : (chart.fatMax ?? base.fatMax),
    fatStep: chart.fatStep ?? base.fatStep,
    snfMin: chart.snfMin ?? base.snfMin,
    snfMax: chart.snfMax ?? base.snfMax,
    snfStep: chart.snfStep ?? base.snfStep,
  };
  if (kind === "fat-only") {
    const inferred = inferredPointRate(next.cells);
    const staleGenerated =
      resolvedKgFatRate(next) > 0 && inferred != null && Math.abs(inferred - fatPointRate(next)) > 0.05;
    const maxCellFat = next.cells.reduce((m, c) => Math.max(m, c.fat), 0);
    const rangeShort = !next.cells.length || maxCellFat < next.fatMax - 0.05;
    if (!next.cells.length || cellsLookLikeFatEqualsRate(next.cells) || staleGenerated || rangeShort) {
      next.cells = generateFatOnlyCells(next);
    }
  }
  return next;
}

export function ensureMethodCharts(charts: RateChart[]) {
  const next = charts.map((c) => normalizeChart(c));
  for (const kind of ["fat-only", "formula", "grid"] as const) {
    for (const milk of ["cow", "buffalo"] as const) {
      if (!next.some((c) => c.kind === kind && milkKey(c.milkType) === milk)) {
        const created = defaultChart(kind, milk);
        if (kind === "fat-only" && milk === "buffalo") created.cells = generateFatOnlyCells(created);
        if (kind === "formula" && milk === "cow") created.cells = generateFormulaCells(created);
        next.push(created);
      }
    }
  }
  return next.map((c) => {
    if (c.cells.length) return c;
    if (c.kind === "fat-only" && milkKey(c.milkType) === "buffalo") {
      return { ...c, cells: generateFatOnlyCells(c) };
    }
    if (c.kind === "formula" && milkKey(c.milkType) === "cow") {
      return { ...c, cells: generateFormulaCells(c) };
    }
    return c;
  });
}

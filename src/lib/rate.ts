import { round2 } from "@/lib/money";
import type { ChartMethod, MilkType, RateCell, RateChart } from "@/lib/types";

export const METHOD_LABEL: Record<ChartMethod, string> = {
  "fat-only": "Rate by FAT only",
  formula: "SNF + FAT (Auto formula)",
  grid: "SNF + FAT (Manual chart)",
};

export function milkKey(milkType: MilkType | "all"): MilkType {
  return milkType === "buffalo" ? "buffalo" : "cow";
}

export function defaultRanges(milk: MilkType) {
  if (milk === "buffalo") {
    return { fatMin: 5, fatMax: 11.5, fatStep: 0.1, snfMin: 8, snfMax: 11, snfStep: 0.1 };
  }
  return { fatMin: 3, fatMax: 6.5, fatStep: 0.1, snfMin: 8, snfMax: 10, snfStep: 0.1 };
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

export function formulaRate(chart: RateChart, fat: number, snf: number) {
  return round2(chart.base + fat * chart.fatCoeff + snf * chart.snfCoeff);
}

export function fatOnlyRate(chart: RateChart, fat: number) {
  return round2(fat * (chart.fatRate || 0) + (chart.base || 0));
}

export function lookupRate(chart: RateChart | undefined, fat: number, snf: number) {
  if (!chart || !fat) return 0;
  if (chart.kind === "fat-only") {
    if (chart.cells.length) return round2(nearestCell(chart.cells, fat, 0, false).rate);
    return fatOnlyRate(chart, fat);
  }
  if (!snf) return 0;
  if (chart.cells.length) return round2(nearestCell(chart.cells, fat, snf, true).rate);
  return formulaRate(chart, fat, snf);
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
    rate: fatOnlyRate(chart, fat),
  }));
}

export function generateFormulaCells(chart: RateChart): RateCell[] {
  const { fats, snfs } = chartAxes(chart);
  const cells: RateCell[] = [];
  for (const fat of fats) {
    for (const snf of snfs) {
      cells.push({ fat, snf, rate: formulaRate(chart, fat, snf) });
    }
  }
  return cells;
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
    base: isBuffalo ? 3 : 2.5,
    fatRate: isBuffalo ? 10 : 9,
    ...ranges,
    cells: [],
    active: kind === "formula",
  };
}

export function normalizeChart(chart: Partial<RateChart> & Pick<RateChart, "id">): RateChart {
  const kind: ChartMethod = chart.kind === "grid" ? "grid" : chart.kind === "fat-only" ? "fat-only" : "formula";
  const milk = milkKey(chart.milkType ?? "cow");
  const base = defaultChart(kind, milk);
  return {
    ...base,
    ...chart,
    kind,
    milkType: milk,
    cells: chart.cells ?? [],
    fatMin: chart.fatMin ?? base.fatMin,
    fatMax: chart.fatMax ?? base.fatMax,
    fatStep: chart.fatStep ?? base.fatStep,
    snfMin: chart.snfMin ?? base.snfMin,
    snfMax: chart.snfMax ?? base.snfMax,
    snfStep: chart.snfStep ?? base.snfStep,
    fatRate: chart.fatRate ?? base.fatRate,
    fatCoeff: chart.fatCoeff ?? base.fatCoeff,
    snfCoeff: chart.snfCoeff ?? base.snfCoeff,
    base: chart.base ?? base.base,
  };
}

export function ensureMethodCharts(charts: RateChart[]) {
  const next = charts.map((c) => normalizeChart(c));
  for (const kind of ["fat-only", "formula", "grid"] as const) {
    for (const milk of ["cow", "buffalo"] as const) {
      if (!next.some((c) => c.kind === kind && milkKey(c.milkType) === milk)) {
        const created = defaultChart(kind, milk);
        if (kind === "formula") created.cells = generateFormulaCells(created);
        next.push(created);
      }
    }
  }
  return next.map((c) =>
    c.kind === "formula" && c.cells.length === 0 ? { ...c, cells: generateFormulaCells(c) } : c,
  );
}

import { round2 } from "@/lib/money";
import type { MilkType, RateChart } from "@/lib/types";

export function lookupRate(chart: RateChart | undefined, fat: number, snf: number) {
  if (!chart || !fat || !snf) return 0;
  if (chart.kind === "grid" && chart.cells.length) {
    let best = chart.cells[0];
    let dist = Number.POSITIVE_INFINITY;
    for (const cell of chart.cells) {
      const d = Math.abs(cell.fat - fat) + Math.abs(cell.snf - snf);
      if (d < dist) {
        dist = d;
        best = cell;
      }
    }
    return round2(best.rate);
  }
  return round2(chart.base + fat * chart.fatCoeff + snf * chart.snfCoeff);
}

export function pickChart(charts: RateChart[], milkType: MilkType) {
  return (
    charts.find((c) => c.active && (c.milkType === milkType || c.milkType === "all")) ??
    charts.find((c) => c.active) ??
    charts[0]
  );
}

export function calcAmount(qty: number, rate: number) {
  return round2(qty * rate);
}

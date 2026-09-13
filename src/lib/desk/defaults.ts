import { DEFAULT_DAIRY_LOGO } from "@/lib/profile";
import { defaultChart, ensureMethodCharts, generateFatOnlyCells, generateFormulaCells } from "@/lib/rate";
import type { DairyState, RateChart, Settings } from "@/lib/types";

export function defaultSettings(): Settings {
  return {
    dairyName: "DudhSetu",
    centerName: "Collection Centre",
    phone: "",
    address: "",
    logo: DEFAULT_DAIRY_LOGO,
    profileComplete: true,
    rateMethod: "formula",
    cowMethod: "formula",
    buffaloMethod: "fat-only",
  };
}

export function defaultCharts(): RateChart[] {
  const cow = defaultChart("formula", "cow");
  cow.id = "chart-cow";
  cow.cells = generateFormulaCells(cow);
  const buffalo = defaultChart("fat-only", "buffalo");
  buffalo.id = "chart-buffalo";
  buffalo.cells = generateFatOnlyCells(buffalo);
  return ensureMethodCharts([cow, buffalo]);
}

export function emptyDeskState(): DairyState {
  return {
    settings: defaultSettings(),
    farmers: [],
    entries: [],
    charts: defaultCharts(),
    advances: [],
    bills: [],
  };
}

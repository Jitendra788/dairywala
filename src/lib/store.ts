import { todayISO } from "@/lib/dates";
import { calcAmount, ensureMethodCharts, methodForMilk, normalizeChart, pickChart, quoteRate } from "@/lib/rate";
import { round2 } from "@/lib/money";
import { createSeedState } from "@/lib/seed";
import { DEFAULT_DAIRY_LOGO } from "@/lib/profile";
import type {
  Advance,
  Bill,
  CollectionEntry,
  DairyState,
  Farmer,
  MilkType,
  RateChart,
  Settings,
  Shift,
} from "@/lib/types";

const KEY = "tony-dairy-v1";

const defaultState = createSeedState();
let state: DairyState = defaultState;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function persist() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

function setState(next: DairyState) {
  state = next;
  persist();
  emit();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return state;
}

export function getServerSnapshot() {
  return defaultState;
}

export function hydrateDairy() {
  if (typeof window === "undefined" || hydrated) return;
  hydrated = true;
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      state = migrateState(JSON.parse(raw) as DairyState);
      persist();
      emit();
      return;
    } catch {
      // fall through to seed
    }
  }
  state = createSeedState();
  persist();
  emit();
}

function migrateState(raw: DairyState): DairyState {
  return {
    ...raw,
    settings: {
      ...raw.settings,
      logo: raw.settings.logo || DEFAULT_DAIRY_LOGO,
      dairyName: raw.settings.dairyName || "Tony Dairy",
      profileComplete: true,
      rateMethod: raw.settings.rateMethod ?? "formula",
      cowMethod: raw.settings.cowMethod ?? raw.settings.rateMethod ?? "formula",
      buffaloMethod: raw.settings.buffaloMethod ?? "fat-only",
    },
    charts: ensureMethodCharts(raw.charts ?? []),
  };
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function farmerById(farmerId: string) {
  return state.farmers.find((f) => f.id === farmerId);
}

export function farmerByCode(code: string) {
  return state.farmers.find((f) => f.code === code.trim());
}

export function farmerBalance(farmerId: string) {
  const milk = state.entries
    .filter((e) => e.farmerId === farmerId)
    .reduce((s, e) => s + e.amount, 0);
  const advances = state.advances
    .filter((a) => a.farmerId === farmerId)
    .reduce((s, a) => s + a.amount, 0);
  const paid = state.bills
    .filter((b) => b.farmerId === farmerId && b.status === "paid")
    .reduce((s, b) => s + b.net, 0);
  return round2(milk - advances - paid);
}

export function addFarmer(input: Omit<Farmer, "id" | "createdAt">) {
  if (farmerByCode(input.code)) {
    throw new Error("Farmer code already exists");
  }
  const farmer: Farmer = {
    ...input,
    id: uid("f"),
    createdAt: new Date().toISOString(),
  };
  setState({ ...state, farmers: [...state.farmers, farmer] });
  return farmer;
}

export function updateFarmer(id: string, patch: Partial<Farmer>) {
  if (patch.code && state.farmers.some((f) => f.id !== id && f.code === patch.code)) {
    throw new Error("Farmer code already exists");
  }
  setState({
    ...state,
    farmers: state.farmers.map((f) => (f.id === id ? { ...f, ...patch } : f)),
  });
}

export function deleteFarmer(id: string) {
  if (state.entries.some((e) => e.farmerId === id && e.billId)) {
    throw new Error("Billed slips wali farmer delete nahi ho sakti");
  }
  setState({
    ...state,
    farmers: state.farmers.filter((f) => f.id !== id),
    entries: state.entries.filter((e) => e.farmerId !== id),
    advances: state.advances.filter((a) => a.farmerId !== id),
    bills: state.bills.filter((b) => b.farmerId !== id),
  });
}

export function addCollection(input: {
  farmerId: string;
  date: string;
  shift: Shift;
  milkType: MilkType;
  qty: number;
  fat: number;
  snf: number;
  clr: number;
}) {
  const rate = pricedRate(input.milkType, input.fat, input.snf);
  const entry: CollectionEntry = {
    id: uid("col"),
    farmerId: input.farmerId,
    date: input.date,
    shift: input.shift,
    milkType: input.milkType,
    qty: input.qty,
    fat: input.fat,
    snf: input.snf,
    clr: input.clr,
    rate,
    amount: calcAmount(input.qty, rate),
    billId: null,
    createdAt: new Date().toISOString(),
  };
  setState({ ...state, entries: [entry, ...state.entries] });
  return entry;
}

export function updateCollection(
  id: string,
  input: {
    farmerId: string;
    date: string;
    shift: Shift;
    milkType: MilkType;
    qty: number;
    fat: number;
    snf: number;
    clr: number;
  },
) {
  const existing = state.entries.find((e) => e.id === id);
  if (!existing) throw new Error("Slip nahi mili");
  if (existing.billId) throw new Error("Billed slip edit nahi ho sakti");
  const rate = pricedRate(input.milkType, input.fat, input.snf);
  setState({
    ...state,
    entries: state.entries.map((e) =>
      e.id === id
        ? {
            ...e,
            ...input,
            rate,
            amount: calcAmount(input.qty, rate),
          }
        : e,
    ),
  });
}

export function deleteCollection(id: string) {
  const entry = state.entries.find((e) => e.id === id);
  if (entry?.billId) throw new Error("Billed slip delete nahi ho sakti");
  setState({ ...state, entries: state.entries.filter((e) => e.id !== id) });
}

export function lastEntryForFarmer(farmerId: string) {
  return state.entries.find((e) => e.farmerId === farmerId);
}

export function saveCharts(charts: RateChart[]) {
  setState({ ...state, charts });
}

function pricedRate(milkType: MilkType, fat: number, snf: number) {
  const method = methodForMilk(state.settings, milkType);
  const chart = pickChart(state.charts, milkType, method);
  return quoteRate(chart, fat, snf).rate;
}

export function addChart(input: Omit<RateChart, "id" | "cells">) {
  const chart = normalizeChart({
    ...input,
    id: uid("chart"),
    cells: [],
  });
  setState({ ...state, charts: [...state.charts, chart] });
  return chart;
}

export function deleteChart(id: string) {
  if (state.charts.length <= 1) throw new Error("Kam se kam ek rate chart chahiye");
  setState({ ...state, charts: state.charts.filter((c) => c.id !== id) });
}

export function updateAdvance(
  id: string,
  input: { farmerId: string; amount: number; note: string; date: string },
) {
  const existing = state.advances.find((a) => a.id === id);
  if (!existing) throw new Error("Advance nahi mila");
  if (existing.recovered) throw new Error("Recovered advance edit nahi ho sakta");
  setState({
    ...state,
    advances: state.advances.map((a) => (a.id === id ? { ...a, ...input } : a)),
  });
}

export function deleteAdvance(id: string) {
  const existing = state.advances.find((a) => a.id === id);
  if (existing?.recovered) throw new Error("Recovered advance delete nahi ho sakta");
  setState({ ...state, advances: state.advances.filter((a) => a.id !== id) });
}

export function deleteBill(id: string) {
  const bill = state.bills.find((b) => b.id === id);
  if (!bill) throw new Error("Bill nahi mili");
  if (bill.status === "paid") throw new Error("Paid bill delete nahi ho sakti");
  setState({
    ...state,
    bills: state.bills.filter((b) => b.id !== id),
    entries: state.entries.map((e) => (e.billId === id ? { ...e, billId: null } : e)),
    advances: state.advances.map((a) =>
      a.billId === id ? { ...a, recovered: false, billId: null } : a,
    ),
  });
}

export function addAdvance(input: { farmerId: string; amount: number; note: string; date: string }) {
  const advance: Advance = {
    id: uid("adv"),
    farmerId: input.farmerId,
    amount: input.amount,
    note: input.note,
    date: input.date,
    recovered: false,
    billId: null,
  };
  setState({ ...state, advances: [advance, ...state.advances] });
  return advance;
}

export function generateBills(fromDate: string, toDate: string) {
  const open = state.entries.filter(
    (e) => !e.billId && e.date >= fromDate && e.date <= toDate,
  );
  const byFarmer = new Map<string, CollectionEntry[]>();
  for (const entry of open) {
    const list = byFarmer.get(entry.farmerId) ?? [];
    list.push(entry);
    byFarmer.set(entry.farmerId, list);
  }

  const newBills: Bill[] = [];
  const billedIds = new Set<string>();
  const recoveredIds = new Set<string>();
  const recoverMap = new Map<string, string>();

  for (const [farmerId, list] of byFarmer) {
    const qty = list.reduce((s, e) => s + e.qty, 0);
    const gross = round2(list.reduce((s, e) => s + e.amount, 0));
    const avgFat = qty ? round2(list.reduce((s, e) => s + e.fat * e.qty, 0) / qty) : 0;
    const avgSnf = qty ? round2(list.reduce((s, e) => s + e.snf * e.qty, 0) / qty) : 0;
    const pending = state.advances.filter((a) => a.farmerId === farmerId && !a.recovered);
    let remaining = gross;
    let advance = 0;
    const billId = uid("bill");
    for (const item of pending) {
      if (item.amount > remaining) continue;
      remaining = round2(remaining - item.amount);
      advance += item.amount;
      recoveredIds.add(item.id);
      recoverMap.set(item.id, billId);
    }
    advance = round2(advance);
    const bill: Bill = {
      id: billId,
      farmerId,
      fromDate,
      toDate,
      qty: round2(qty),
      avgFat,
      avgSnf,
      gross,
      advance,
      net: round2(gross - advance),
      status: "open",
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    newBills.push(bill);
    list.forEach((e) => billedIds.add(e.id));
  }

  setState({
    ...state,
    bills: [...newBills, ...state.bills],
    entries: state.entries.map((e) => {
      if (!billedIds.has(e.id)) return e;
      const bill = newBills.find((b) => b.farmerId === e.farmerId);
      return bill ? { ...e, billId: bill.id } : e;
    }),
    advances: state.advances.map((a) =>
      recoveredIds.has(a.id)
        ? { ...a, recovered: true, billId: recoverMap.get(a.id) ?? a.billId }
        : a,
    ),
  });
  return newBills;
}

export function markBillPaid(id: string) {
  setState({
    ...state,
    bills: state.bills.map((b) =>
      b.id === id
        ? { ...b, status: "paid", paidAt: new Date().toISOString() }
        : b,
    ),
  });
}

export function updateSettings(patch: Partial<Settings>) {
  setState({ ...state, settings: { ...state.settings, ...patch } });
}

export function resetDemo() {
  const next = createSeedState();
  setState(next);
}

export function todayStats(date = todayISO()) {
  const rows = state.entries.filter((e) => e.date === date);
  const qty = rows.reduce((s, e) => s + e.qty, 0);
  const amount = rows.reduce((s, e) => s + e.amount, 0);
  const avgFat = qty ? rows.reduce((s, e) => s + e.fat * e.qty, 0) / qty : 0;
  const avgSnf = qty ? rows.reduce((s, e) => s + e.snf * e.qty, 0) / qty : 0;
  return {
    qty: round2(qty),
    amount: round2(amount),
    avgFat: round2(avgFat),
    avgSnf: round2(avgSnf),
    farmers: new Set(rows.map((e) => e.farmerId)).size,
    slips: rows.length,
    morning: round2(rows.filter((e) => e.shift === "morning").reduce((s, e) => s + e.qty, 0)),
    evening: round2(rows.filter((e) => e.shift === "evening").reduce((s, e) => s + e.qty, 0)),
  };
}

export function payableTotal() {
  return round2(state.farmers.reduce((s, f) => s + farmerBalance(f.id), 0));
}

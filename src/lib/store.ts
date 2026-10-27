import { todayISO } from "@/lib/dates";
import { customerApi } from "@/lib/customers/client";
import { emptyDeskState } from "@/lib/desk/defaults";
import { round2 } from "@/lib/money";
import type {
  Advance,
  Bill,
  CollectionEntry,
  DairyState,
  Farmer,
  MilkType,
  FarmerPayment,
  RateChart,
  Settings,
  Shift,
} from "@/lib/types";

const emptyState = emptyDeskState();
let state: DairyState = emptyState;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function apply(next: DairyState) {
  state = next;
  emit();
}

type OpResult<T> = { state?: DairyState; result: T };

function mergeById<T extends { id: string }>(server: T[], local: T[]) {
  const map = new Map(server.map((row) => [row.id, row]));
  for (const row of local) {
    if (!map.has(row.id)) map.set(row.id, row);
  }
  return [...map.values()];
}

function applyOp(op: string, payload: Record<string, unknown>, result: unknown) {
  if (op === "addCollection" && result && typeof result === "object") {
    const entry = result as CollectionEntry;
    apply({ ...state, entries: [entry, ...state.entries.filter((row) => row.id !== entry.id && !row.id.startsWith("tmp-"))] });
    return;
  }
  if (op === "updateCollection" && result && typeof result === "object") {
    const entry = result as CollectionEntry;
    apply({ ...state, entries: state.entries.map((row) => (row.id === entry.id ? entry : row)) });
    return;
  }
  if (op === "deleteCollection") {
    apply({ ...state, entries: state.entries.filter((row) => row.id !== String(payload.id || "")) });
    return;
  }
  if (op === "addFarmer" && result && typeof result === "object") {
    const farmer = result as Farmer;
    apply({ ...state, farmers: [...state.farmers.filter((row) => row.id !== farmer.id), farmer] });
    return;
  }
  if (op === "updateFarmer") {
    apply({
      ...state,
      farmers: state.farmers.map((row) => (row.id === payload.id ? { ...row, ...payload, id: row.id } : row)),
    });
    return;
  }
  if (op === "addFarmerPayment" && result && typeof result === "object") {
    const payment = result as FarmerPayment;
    apply({
      ...state,
      payments: [payment, ...(state.payments || []).filter((row) => row.id !== payment.id && !row.id.startsWith("tmp-"))],
    });
    return;
  }
  if (op === "addAdvance" && result && typeof result === "object") {
    const advance = result as Advance;
    apply({
      ...state,
      advances: [advance, ...state.advances.filter((row) => row.id !== advance.id && !row.id.startsWith("tmp-"))],
    });
    return;
  }
  if (op === "updateAdvance") {
    apply({
      ...state,
      advances: state.advances.map((row) => (row.id === payload.id ? { ...row, ...payload, id: row.id } : row)),
    });
    return;
  }
  if (op === "deleteAdvance") {
    apply({ ...state, advances: state.advances.filter((row) => row.id !== String(payload.id || "")) });
    return;
  }
  if (op === "deleteBill") {
    apply({ ...state, bills: state.bills.filter((row) => row.id !== String(payload.id || "")) });
    return;
  }
  if (op === "addChart" && result && typeof result === "object") {
    const chart = result as RateChart;
    apply({ ...state, charts: [...state.charts.filter((row) => row.id !== chart.id), chart] });
    return;
  }
  if (op === "deleteChart") {
    apply({ ...state, charts: state.charts.filter((row) => row.id !== String(payload.id || "")) });
    return;
  }
}

async function postOp<T>(op: string, payload: Record<string, unknown> = {}) {
  const data = await customerApi<OpResult<T>>("/api/dairy", {
    method: "POST",
    body: JSON.stringify({ op, payload }),
  });
  if (data.state) {
    const extraPay =
      op === "addFarmerPayment" && data.result && typeof data.result === "object"
        ? [data.result as unknown as FarmerPayment]
        : [];
    apply({
      ...data.state,
      payments: mergeById(data.state.payments || [], [...(state.payments || []), ...extraPay]),
      advances: mergeById(data.state.advances || [], state.advances || []),
      bills: mergeById(data.state.bills || [], state.bills),
    });
  } else applyOp(op, payload, data.result);
  return data.result;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return state;
}

export function getServerSnapshot() {
  return emptyState;
}

export function resetDesk() {
  hydrated = false;
  hydratePromise = null;
  apply(emptyState);
}

export function hydrateDairy() {
  if (typeof window === "undefined") return Promise.resolve();
  if (hydrated) return hydratePromise ?? Promise.resolve();
  hydrated = true;
  localStorage.removeItem("tony-dairy-v1");
  hydratePromise = customerApi<DairyState>("/api/dairy")
    .then((next) => {
      apply({
        ...next,
        farmers: mergeById(next.farmers, state.farmers),
        entries: mergeById(next.entries, state.entries.filter((row) => !row.id.startsWith("tmp-"))),
        advances: mergeById(next.advances, state.advances.filter((row) => !row.id.startsWith("tmp-"))),
        bills: mergeById(next.bills, state.bills),
        payments: mergeById(next.payments || [], state.payments || []),
        charts: next.charts.length ? next.charts : state.charts,
      });
    })
    .catch((error) => {
      hydrated = false;
      hydratePromise = null;
      throw error;
    });
  return hydratePromise;
}

export function farmerById(farmerId: string) {
  return state.farmers.find((f) => f.id === farmerId);
}

export function farmerByCode(code: string) {
  return state.farmers.find((f) => f.code === code.trim());
}

export function farmerPaidTotal(farmerId: string) {
  const fromPays = (state.payments || []).filter((row) => row.farmerId === farmerId).reduce((sum, row) => sum + row.amount, 0);
  const fromBills = state.bills.filter((bill) => bill.farmerId === farmerId).reduce((sum, bill) => sum + (bill.paidAmount || (bill.status === "paid" ? bill.net : 0)), 0);
  return round2(Math.max(fromPays, fromBills));
}

export function farmerBalance(farmerId: string) {
  const milk = state.entries.filter((e) => e.farmerId === farmerId).reduce((s, e) => s + e.amount, 0);
  const advances = state.advances.filter((a) => a.farmerId === farmerId).reduce((s, a) => s + a.amount, 0);
  return round2(milk - advances - farmerPaidTotal(farmerId));
}

export function addFarmerPayment(input: { farmerId: string; amount: number; date: string; note?: string; billId?: string }) {
  return postOp<FarmerPayment>("addFarmerPayment", input);
}

export function addFarmer(input: Omit<Farmer, "id" | "createdAt">) {
  return postOp<Farmer>("addFarmer", input);
}

export function updateFarmer(id: string, patch: Partial<Farmer>) {
  return postOp("updateFarmer", { ...patch, id });
}

export function deleteFarmer(id: string) {
  return postOp("deleteFarmer", { id });
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
  const prev = state;
  const tempId = `tmp-${Date.now()}`;
  apply({
    ...state,
    entries: [
      {
        id: tempId,
        farmerId: input.farmerId,
        date: input.date,
        shift: input.shift,
        milkType: input.milkType,
        qty: input.qty,
        fat: input.fat,
        snf: input.snf,
        clr: input.clr,
        rate: 0,
        amount: 0,
        billId: null,
        createdAt: new Date().toISOString(),
      },
      ...state.entries,
    ],
  });
  return postOp<CollectionEntry>("addCollection", input).catch((err) => {
    apply(prev);
    throw err;
  });
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
  return postOp("updateCollection", { ...input, id });
}

export function deleteCollection(id: string) {
  return postOp("deleteCollection", { id });
}

export function lastEntryForFarmer(farmerId: string) {
  return state.entries.find((e) => e.farmerId === farmerId);
}

export function saveCharts(charts: RateChart[]) {
  return postOp("saveCharts", { charts });
}

export function addChart(input: Omit<RateChart, "id" | "cells">) {
  return postOp<RateChart>("addChart", input);
}

export function deleteChart(id: string) {
  return postOp("deleteChart", { id });
}

export function updateAdvance(id: string, input: { farmerId: string; amount: number; note: string; date: string }) {
  return postOp("updateAdvance", { ...input, id });
}

export function deleteAdvance(id: string) {
  return postOp("deleteAdvance", { id });
}

export function deleteBill(id: string) {
  return postOp("deleteBill", { id });
}

export function addAdvance(input: { farmerId: string; amount: number; note: string; date: string }) {
  const prev = state;
  apply({
    ...state,
    advances: [
      {
        id: `tmp-${Date.now()}`,
        farmerId: input.farmerId,
        amount: input.amount,
        note: input.note,
        date: input.date,
        recovered: false,
        billId: null,
        createdAt: new Date().toISOString(),
      },
      ...state.advances,
    ],
  });
  return postOp<Advance>("addAdvance", input).catch((err) => {
    apply(prev);
    throw err;
  });
}

export function generateBills(fromDate: string, toDate: string, farmerId?: string) {
  return postOp<Bill[]>("generateBills", { fromDate, toDate, farmerId: farmerId || "" });
}

export function markBillPaid(id: string) {
  const prev = state;
  apply({
    ...state,
    bills: state.bills.map((bill) =>
      bill.id === id
        ? { ...bill, status: "paid" as const, paidAmount: bill.net, remaining: 0, paidAt: new Date().toISOString() }
        : bill,
    ),
  });
  return postOp("markBillPaid", { id }).catch((err) => {
    apply(prev);
    throw err;
  });
}

export function updateSettings(patch: Partial<Settings>) {
  return postOp("updateSettings", patch);
}

export function resetDemo() {
  return postOp("resetDemo");
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

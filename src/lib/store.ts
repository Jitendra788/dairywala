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

type OpResult<T> = { state: DairyState; result: T };

async function postOp<T>(op: string, payload: Record<string, unknown> = {}) {
  const data = await customerApi<OpResult<T>>("/api/dairy", {
    method: "POST",
    body: JSON.stringify({ op, payload }),
  });
  apply(data.state);
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
      apply(next);
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

export function farmerBalance(farmerId: string) {
  const milk = state.entries.filter((e) => e.farmerId === farmerId).reduce((s, e) => s + e.amount, 0);
  const advances = state.advances.filter((a) => a.farmerId === farmerId).reduce((s, a) => s + a.amount, 0);
  const paid = state.bills.filter((b) => b.farmerId === farmerId && b.status === "paid").reduce((s, b) => s + b.net, 0);
  return round2(milk - advances - paid);
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
  return postOp<CollectionEntry>("addCollection", input);
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
      },
      ...state.advances,
    ],
  });
  return postOp<Advance>("addAdvance", input).catch((err) => {
    apply(prev);
    throw err;
  });
}

export function generateBills(fromDate: string, toDate: string) {
  return postOp<Bill[]>("generateBills", { fromDate, toDate });
}

export function markBillPaid(id: string) {
  const prev = state;
  apply({
    ...state,
    bills: state.bills.map((bill) => (bill.id === id ? { ...bill, status: "paid", paidAt: todayISO() } : bill)),
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

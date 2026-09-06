"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  addAdvance,
  addCollection,
  addFarmer,
  deleteCollection,
  deleteFarmer,
  farmerBalance,
  farmerByCode,
  farmerById,
  generateBills,
  getServerSnapshot,
  getSnapshot,
  hydrateDairy,
  lastEntryForFarmer,
  markBillPaid,
  payableTotal,
  resetDemo,
  saveCharts,
  subscribe,
  todayStats,
  updateFarmer,
  updateSettings,
} from "@/lib/store";

export function useDairy() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    hydrateDairy();
  }, []);

  return {
    ...state,
    addFarmer,
    updateFarmer,
    deleteFarmer,
    addCollection,
    deleteCollection,
    addAdvance,
    generateBills,
    markBillPaid,
    saveCharts,
    updateSettings,
    resetDemo,
    farmerByCode,
    farmerById,
    farmerBalance,
    lastEntryForFarmer,
    todayStats,
    payableTotal,
  };
}

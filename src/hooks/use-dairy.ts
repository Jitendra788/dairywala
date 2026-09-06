"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  addAdvance,
  addChart,
  addCollection,
  addFarmer,
  deleteAdvance,
  deleteBill,
  deleteChart,
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
  updateAdvance,
  updateCollection,
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
    updateCollection,
    deleteCollection,
    addAdvance,
    updateAdvance,
    deleteAdvance,
    deleteBill,
    addChart,
    deleteChart,
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

import { addDays, todayISO } from "@/lib/dates";
import { calcAmount, lookupRate } from "@/lib/rate";
import type { CollectionEntry, DairyState, Farmer, RateChart } from "@/lib/types";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const cowChart: RateChart = {
  id: "chart-cow",
  name: "Cow FAT+SNF",
  kind: "formula",
  milkType: "cow",
  fatCoeff: 6.85,
  snfCoeff: 3.95,
  base: 2.5,
  cells: [],
  active: true,
};

const buffaloChart: RateChart = {
  id: "chart-buffalo",
  name: "Buffalo FAT+SNF",
  kind: "formula",
  milkType: "buffalo",
  fatCoeff: 7.35,
  snfCoeff: 4.15,
  base: 3,
  cells: [],
  active: true,
};

const farmerSeed: Omit<Farmer, "createdAt">[] = [
  { id: "f-101", code: "101", name: "Ramesh Yadav", phone: "9876501011", milkType: "buffalo", bankName: "SBI", accountNo: "1122334455", ifsc: "SBIN0001234", upi: "ramesh@upi" },
  { id: "f-102", code: "102", name: "Sita Devi", phone: "9876501022", milkType: "cow", bankName: "BOB", accountNo: "5566778899", ifsc: "BARB0JAIPUR", upi: "sita@upi" },
  { id: "f-103", code: "103", name: "Harish Patel", phone: "9876501033", milkType: "buffalo", bankName: "PNB", accountNo: "9988776655", ifsc: "PUNB0123400", upi: "harish@upi" },
  { id: "f-104", code: "104", name: "Kamla Bai", phone: "9876501044", milkType: "cow", bankName: "SBI", accountNo: "4433221100", ifsc: "SBIN0005678", upi: "kamla@upi" },
  { id: "f-105", code: "105", name: "Jitendra Singh", phone: "9876501055", milkType: "mixed", bankName: "HDFC", accountNo: "2211003344", ifsc: "HDFC0001111", upi: "jiten@upi" },
];

function makeEntry(
  farmer: Farmer,
  date: string,
  shift: CollectionEntry["shift"],
  milkType: CollectionEntry["milkType"],
  qty: number,
  fat: number,
  snf: number,
  clr: number,
): CollectionEntry {
  const chart = milkType === "buffalo" ? buffaloChart : cowChart;
  const rate = lookupRate(chart, fat, snf);
  return {
    id: id("col"),
    farmerId: farmer.id,
    date,
    shift,
    milkType,
    qty,
    fat,
    snf,
    clr,
    rate,
    amount: calcAmount(qty, rate),
    billId: null,
    createdAt: `${date}T${shift === "morning" ? "07" : "18"}:10:00`,
  };
}

export function createSeedState(): DairyState {
  const today = todayISO();
  const farmers: Farmer[] = farmerSeed.map((f) => ({
    ...f,
    createdAt: addDays(today, -40),
  }));

  const byCode = Object.fromEntries(farmers.map((f) => [f.code, f]));
  const entries: CollectionEntry[] = [];

  for (let i = 9; i >= 0; i--) {
    const date = addDays(today, -i);
    entries.push(
      makeEntry(byCode["101"], date, "morning", "buffalo", 18.5, 6.4, 8.9, 28),
      makeEntry(byCode["102"], date, "morning", "cow", 12.0, 4.1, 8.6, 30),
      makeEntry(byCode["103"], date, "morning", "buffalo", 22.0, 6.8, 9.0, 27),
    );
    if (i % 2 === 0) {
      entries.push(
        makeEntry(byCode["104"], date, "evening", "cow", 9.5, 3.9, 8.5, 29),
        makeEntry(byCode["105"], date, "evening", "buffalo", 15.0, 6.1, 8.8, 28),
      );
    }
  }

  return {
    settings: {
      dairyName: "Tony Dairy",
      centerName: "Bagru Collection Centre",
      phone: "9352729857",
      address: "Jaipur, Rajasthan",
    },
    farmers,
    entries,
    charts: [cowChart, buffaloChart],
    advances: [
      {
        id: "adv-1",
        farmerId: "f-101",
        amount: 2000,
        note: "Cattle feed",
        date: addDays(today, -4),
        recovered: false,
        billId: null,
      },
    ],
    bills: [],
  };
}

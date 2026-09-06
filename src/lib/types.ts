export type MilkType = "cow" | "buffalo";
export type Shift = "morning" | "evening";
export type ChartKind = "formula" | "grid";
export type BillStatus = "open" | "paid";

export type Farmer = {
  id: string;
  code: string;
  name: string;
  phone: string;
  milkType: MilkType | "mixed";
  bankName: string;
  accountNo: string;
  ifsc: string;
  upi: string;
  createdAt: string;
};

export type CollectionEntry = {
  id: string;
  farmerId: string;
  date: string;
  shift: Shift;
  milkType: MilkType;
  qty: number;
  fat: number;
  snf: number;
  clr: number;
  rate: number;
  amount: number;
  billId: string | null;
  createdAt: string;
};

export type RateCell = {
  fat: number;
  snf: number;
  rate: number;
};

export type RateChart = {
  id: string;
  name: string;
  kind: ChartKind;
  milkType: MilkType | "all";
  fatCoeff: number;
  snfCoeff: number;
  base: number;
  cells: RateCell[];
  active: boolean;
};

export type Advance = {
  id: string;
  farmerId: string;
  amount: number;
  note: string;
  date: string;
  recovered: boolean;
  billId: string | null;
};

export type Bill = {
  id: string;
  farmerId: string;
  fromDate: string;
  toDate: string;
  qty: number;
  avgFat: number;
  avgSnf: number;
  gross: number;
  advance: number;
  net: number;
  status: BillStatus;
  createdAt: string;
  paidAt: string | null;
};

export type Settings = {
  dairyName: string;
  centerName: string;
  phone: string;
  address: string;
};

export type DairyState = {
  settings: Settings;
  farmers: Farmer[];
  entries: CollectionEntry[];
  charts: RateChart[];
  advances: Advance[];
  bills: Bill[];
};

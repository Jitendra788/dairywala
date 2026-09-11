export const EXPENSE_CATEGORIES = [
  "Fuel",
  "Feed",
  "Salary",
  "Rent",
  "Electricity",
  "Transport",
  "Maintenance",
  "Packaging",
  "Other",
] as const;

export const EXPENSE_STATUSES = ["paid", "pending"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
export type FinanceGrain = "day" | "week" | "month" | "year";

export type Expense = {
  id: string;
  dairyId: string;
  date: string;
  category: string;
  amount: number;
  spentBy: string;
  remark: string;
  status: ExpenseStatus;
  deletedAt: string | null;
  createdAt: string;
};

export type DayPoint = {
  date: string;
  subscription: number;
  counter: number;
  purchase: number;
  expense: number;
  earning: number;
};

export type FinanceTotals = {
  subscription: number;
  counter: number;
  purchase: number;
  expense: number;
  earning: number;
  inflow: number;
  outflow: number;
  margin: number;
};

export type TodayMission = {
  total: number;
  delivered: number;
  pending: number;
  missed: number;
  morningDone: number;
  morningTotal: number;
  eveningDone: number;
  eveningTotal: number;
};

export type TodayPnl = {
  morningSales: number;
  eveningSales: number;
  counterSales: number;
  purchase: number;
  expense: number;
  earning: number;
  margin: number;
};

export type FinanceReport = {
  from: string;
  to: string;
  totals: FinanceTotals;
  series: DayPoint[];
  today: {
    date: string;
    mission: TodayMission;
    pnl: TodayPnl;
  };
};

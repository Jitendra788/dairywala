import { randomUUID } from "node:crypto";
import { eachDay, todayISO } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { assertDairy, qall, qget, qrun } from "@/lib/customers/db";
import { CustomerError } from "@/lib/customers/errors";
import type {
  DayPoint,
  Expense,
  ExpenseStatus,
  FinanceReport,
  FinanceTotals,
} from "@/lib/finance/types";
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES } from "@/lib/finance/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function nowISO() {
  return new Date().toISOString();
}

function num(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0);
}

function str(value: unknown) {
  return value == null ? "" : String(value);
}

function validateDate(value: string, label: string) {
  if (!DATE_RE.test(value)) throw new CustomerError(`${label} must be yyyy-mm-dd`);
}

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    id: str(row.id),
    dairyId: str(row.dairyId),
    date: str(row.date),
    category: str(row.category),
    amount: round2(num(row.amount)),
    spentBy: str(row.spentBy),
    remark: str(row.remark),
    status: (str(row.status) === "pending" ? "pending" : "paid") as ExpenseStatus,
    deletedAt: row.deletedAt == null || row.deletedAt === "" ? null : str(row.deletedAt),
    createdAt: str(row.createdAt),
  };
}

function emptyPoint(date: string): DayPoint {
  return { date, subscription: 0, counter: 0, purchase: 0, expense: 0, earning: 0 };
}

function totalsFromSeries(series: DayPoint[]): FinanceTotals {
  const subscription = round2(series.reduce((s, p) => s + p.subscription, 0));
  const counter = round2(series.reduce((s, p) => s + p.counter, 0));
  const purchase = round2(series.reduce((s, p) => s + p.purchase, 0));
  const expense = round2(series.reduce((s, p) => s + p.expense, 0));
  const inflow = round2(subscription + counter);
  const outflow = round2(purchase + expense);
  const earning = round2(inflow - outflow);
  return {
    subscription,
    counter,
    purchase,
    expense,
    earning,
    inflow,
    outflow,
    margin: inflow > 0 ? round2((earning / inflow) * 100) : 0,
  };
}

export async function listExpenses(
  dairyId: string,
  from: string,
  to: string,
  includeDeleted = false,
) {
  await assertDairy(dairyId);
  validateDate(from, "From");
  validateDate(to, "To");
  let sql = `SELECT * FROM Expense WHERE dairyId = ? AND date >= ? AND date <= ?`;
  const params: unknown[] = [dairyId, from, to];
  if (!includeDeleted) sql += ` AND deletedAt IS NULL`;
  sql += ` ORDER BY date DESC, createdAt DESC`;
  const rows = await qall(sql, ...params);
  return rows.map(mapExpense);
}

export async function createExpense(
  dairyId: string,
  input: {
    date: string;
    category: string;
    amount: number;
    spentBy: string;
    remark?: string;
    status?: ExpenseStatus;
  },
) {
  await assertDairy(dairyId);
  validateDate(input.date, "Date");
  if (!EXPENSE_CATEGORIES.includes(input.category as (typeof EXPENSE_CATEGORIES)[number])) {
    throw new CustomerError("Choose a valid expense category");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new CustomerError("Amount must be greater than 0");
  }
  const status = input.status && EXPENSE_STATUSES.includes(input.status) ? input.status : "paid";
  const id = randomUUID();
  const createdAt = nowISO();
  await qrun(
    `INSERT INTO Expense (id, dairyId, date, category, amount, spentBy, remark, status, deletedAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    id,
    dairyId,
    input.date,
    input.category,
    round2(input.amount),
    (input.spentBy || "").trim() || "Owner",
    (input.remark || "").trim(),
    status,
    createdAt,
  );
  const row = await qget(`SELECT * FROM Expense WHERE id = ?`, id);
  return mapExpense(row!);
}

export async function updateExpense(
  dairyId: string,
  id: string,
  input: {
    date?: string;
    category?: string;
    amount?: number;
    spentBy?: string;
    remark?: string;
    status?: ExpenseStatus;
  },
) {
  const current = await qget(`SELECT * FROM Expense WHERE dairyId = ? AND id = ?`, dairyId, id);
  if (!current) throw new CustomerError("Expense not found", 404);
  const next = mapExpense(current);
  if (input.date) {
    validateDate(input.date, "Date");
    next.date = input.date;
  }
  if (input.category) {
    if (!EXPENSE_CATEGORIES.includes(input.category as (typeof EXPENSE_CATEGORIES)[number])) {
      throw new CustomerError("Choose a valid expense category");
    }
    next.category = input.category;
  }
  if (input.amount != null) {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new CustomerError("Amount must be greater than 0");
    }
    next.amount = round2(input.amount);
  }
  if (input.spentBy != null) next.spentBy = input.spentBy.trim() || next.spentBy;
  if (input.remark != null) next.remark = input.remark.trim();
  if (input.status && EXPENSE_STATUSES.includes(input.status)) next.status = input.status;
  await qrun(
    `UPDATE Expense SET date = ?, category = ?, amount = ?, spentBy = ?, remark = ?, status = ? WHERE dairyId = ? AND id = ?`,
    next.date,
    next.category,
    next.amount,
    next.spentBy,
    next.remark,
    next.status,
    dairyId,
    id,
  );
  return next;
}

export async function deleteExpense(dairyId: string, id: string) {
  const current = await qget(`SELECT * FROM Expense WHERE dairyId = ? AND id = ?`, dairyId, id);
  if (!current) throw new CustomerError("Expense not found", 404);
  await qrun(`UPDATE Expense SET deletedAt = ? WHERE dairyId = ? AND id = ?`, nowISO(), dairyId, id);
  return { ok: true };
}

export async function financeReport(
  dairyId: string,
  from: string,
  to: string,
  includeDeleted = false,
): Promise<FinanceReport> {
  await assertDairy(dairyId);
  validateDate(from, "From");
  validateDate(to, "To");
  const today = todayISO();
  const days = eachDay(from, to);
  const points = new Map(days.map((date) => [date, emptyPoint(date)]));

  const sales = await qall(
    `SELECT date,
            COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'subscription' AND status IN ('delivered','partial','extra') THEN amount ELSE 0 END), 0) AS subscription,
            COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'walkin' THEN amount ELSE 0 END), 0) AS counter
     FROM DailyMilkDelivery
     WHERE dairyId = ? AND date >= ? AND date <= ?
     GROUP BY date`,
    dairyId,
    from,
    to,
  );
  for (const row of sales) {
    const point = points.get(str(row.date));
    if (!point) continue;
    point.subscription = round2(num(row.subscription));
    point.counter = round2(num(row.counter));
  }

  const purchases = await qall(
    `SELECT date, COALESCE(SUM(amount), 0) AS purchase
     FROM CollectionEntry
     WHERE dairyId = ? AND date >= ? AND date <= ?
     GROUP BY date`,
    dairyId,
    from,
    to,
  );
  for (const row of purchases) {
    const point = points.get(str(row.date));
    if (point) point.purchase = round2(num(row.purchase));
  }

  let expenseSql = `SELECT date, COALESCE(SUM(amount), 0) AS expense FROM Expense WHERE dairyId = ? AND date >= ? AND date <= ?`;
  const expenseParams: unknown[] = [dairyId, from, to];
  if (!includeDeleted) expenseSql += ` AND deletedAt IS NULL`;
  expenseSql += ` GROUP BY date`;
  const expenses = await qall(expenseSql, ...expenseParams);
  for (const row of expenses) {
    const point = points.get(str(row.date));
    if (point) point.expense = round2(num(row.expense));
  }

  const series = [...points.values()].map((point) => ({
    ...point,
    earning: round2(point.subscription + point.counter - point.purchase - point.expense),
  }));

  const todaySales = await qget(
    `SELECT
        COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'subscription' AND status IN ('delivered','partial','extra') AND IFNULL(s.deliveryTime, '06:00') < '15:00' THEN d.amount ELSE 0 END), 0) AS morningSales,
        COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'subscription' AND status IN ('delivered','partial','extra') AND IFNULL(s.deliveryTime, '06:00') >= '15:00' THEN d.amount ELSE 0 END), 0) AS eveningSales,
        COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'walkin' THEN d.amount ELSE 0 END), 0) AS counterSales
     FROM DailyMilkDelivery d
     LEFT JOIN CustomerSubscription s ON s.customerId = d.customerId
     WHERE d.dairyId = ? AND d.date = ?`,
    dairyId,
    today,
  );
  const todayPurchase = await qget(
    `SELECT COALESCE(SUM(amount), 0) AS purchase FROM CollectionEntry WHERE dairyId = ? AND date = ?`,
    dairyId,
    today,
  );
  const todayExpense = await qget(
    includeDeleted
      ? `SELECT COALESCE(SUM(amount), 0) AS expense FROM Expense WHERE dairyId = ? AND date = ?`
      : `SELECT COALESCE(SUM(amount), 0) AS expense FROM Expense WHERE dairyId = ? AND date = ? AND deletedAt IS NULL`,
    dairyId,
    today,
  );
  const mission = await qget(
    `SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN d.status IN ('delivered','partial','extra') THEN 1 ELSE 0 END), 0) AS delivered,
        COALESCE(SUM(CASE WHEN d.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN d.status IN ('skipped','not_delivered') THEN 1 ELSE 0 END), 0) AS missed,
        COALESCE(SUM(CASE WHEN IFNULL(s.deliveryTime, '06:00') < '15:00' THEN 1 ELSE 0 END), 0) AS morningTotal,
        COALESCE(SUM(CASE WHEN IFNULL(s.deliveryTime, '06:00') < '15:00' AND d.status IN ('delivered','partial','extra') THEN 1 ELSE 0 END), 0) AS morningDone,
        COALESCE(SUM(CASE WHEN IFNULL(s.deliveryTime, '06:00') >= '15:00' THEN 1 ELSE 0 END), 0) AS eveningTotal,
        COALESCE(SUM(CASE WHEN IFNULL(s.deliveryTime, '06:00') >= '15:00' AND d.status IN ('delivered','partial','extra') THEN 1 ELSE 0 END), 0) AS eveningDone
     FROM DailyMilkDelivery d
     LEFT JOIN CustomerSubscription s ON s.customerId = d.customerId
     WHERE d.dairyId = ? AND d.date = ? AND IFNULL(d.source, 'subscription') = 'subscription'`,
    dairyId,
    today,
  );

  const morningSales = round2(num(todaySales?.morningSales));
  const eveningSales = round2(num(todaySales?.eveningSales));
  const counterSales = round2(num(todaySales?.counterSales));
  const purchase = round2(num(todayPurchase?.purchase));
  const expense = round2(num(todayExpense?.expense));
  const inflow = round2(morningSales + eveningSales + counterSales);
  const earning = round2(inflow - purchase - expense);

  return {
    from,
    to,
    totals: totalsFromSeries(series),
    series,
    today: {
      date: today,
      mission: {
        total: num(mission?.total),
        delivered: num(mission?.delivered),
        pending: num(mission?.pending),
        missed: num(mission?.missed),
        morningDone: num(mission?.morningDone),
        morningTotal: num(mission?.morningTotal),
        eveningDone: num(mission?.eveningDone),
        eveningTotal: num(mission?.eveningTotal),
      },
      pnl: {
        morningSales,
        eveningSales,
        counterSales,
        purchase,
        expense,
        earning,
        margin: inflow > 0 ? round2((earning / inflow) * 100) : 0,
      },
    },
  };
}

import { numField, strField, withDairy } from "@/lib/customers/http";
import { endOfMonth, startOfMonth, todayISO } from "@/lib/dates";
import {
  createExpense,
  deleteExpense,
  financeReport,
  listExpenses,
  updateExpense,
} from "@/lib/finance/service";
import type { ExpenseStatus } from "@/lib/finance/types";

export const runtime = "nodejs";

export function handleListExpenses(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || todayISO();
  const to = url.searchParams.get("to") || todayISO();
  const includeDeleted = url.searchParams.get("includeDeleted") === "1";
  return withDairy(request, async (dairyId) => ({
    expenses: await listExpenses(dairyId, from, to, includeDeleted),
  }));
}

export function handleCreateExpense(request: Request) {
  return withDairy(request, async (dairyId, body) => ({
    expense: await createExpense(dairyId, {
      date: strField(body, "date") || todayISO(),
      category: strField(body, "category"),
      amount: numField(body, "amount"),
      spentBy: strField(body, "spentBy"),
      remark: strField(body, "remark"),
      status: (strField(body, "status") || "paid") as ExpenseStatus,
    }),
  }));
}

export function handleUpdateExpense(request: Request, id: string) {
  return withDairy(request, async (dairyId, body) => ({
    expense: await updateExpense(dairyId, id, {
      date: strField(body, "date") || undefined,
      category: strField(body, "category") || undefined,
      amount: body.amount == null || body.amount === "" ? undefined : numField(body, "amount"),
      spentBy: body.spentBy == null ? undefined : strField(body, "spentBy"),
      remark: body.remark == null ? undefined : strField(body, "remark"),
      status: (strField(body, "status") || undefined) as ExpenseStatus | undefined,
    }),
  }));
}

export function handleDeleteExpense(request: Request, id: string) {
  return withDairy(request, async (dairyId) => deleteExpense(dairyId, id));
}

export function handleFinanceReport(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || startOfMonth();
  const to = url.searchParams.get("to") || endOfMonth();
  const includeDeleted = url.searchParams.get("includeDeleted") === "1";
  return withDairy(request, async (dairyId) => financeReport(dairyId, from, to, includeDeleted));
}

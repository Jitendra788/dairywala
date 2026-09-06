import { addDays, todayISO } from "@/lib/dates";
import { DEFAULT_DAIRY_ID } from "@/lib/customers/context";
import {
  createCustomer,
  ensureDeliveriesForDate,
  getCustomerRow,
  getOutstanding,
  listDeliveries,
  listLedger,
  listMonthlyBills,
  listPayments,
  markDelivered,
  markExtra,
  markPartial,
  pauseCustomer,
  recordPayment,
  resumeCustomer,
  seedTestCustomer,
  skipToday,
} from "@/lib/customers/service";

type Check = { name: string; ok: boolean; detail: string };

function check(name: string, ok: boolean, detail: string): Check {
  return { name, ok, detail };
}

export function runCustomerFlowTest(dairyId = DEFAULT_DAIRY_ID) {
  const today = todayISO();
  const checks: Check[] = [];

  const first = seedTestCustomer(dairyId);
  const second = seedTestCustomer(dairyId);
  checks.push(
    check(
      "Customer created once",
      first.id === second.id && first.customerCode === second.customerCode,
      `${first.customerCode} ${first.name} id=${first.id}`,
    ),
  );

  let duplicateBlocked = false;
  try {
    createCustomer(dairyId, {
      name: "Ramesh Duplicate",
      mobile: "9876502001",
      address: "Should not save",
      milkType: "buffalo",
      dailyQty: 2,
      rate: 60,
      startDate: today,
      deliveryTime: "06:30",
      paymentCycle: "monthly",
      status: "active",
    });
  } catch (error) {
    duplicateBlocked = error instanceof Error && /already has a customer/i.test(error.message);
  }
  checks.push(check("Duplicate mobile rejected", duplicateBlocked, "Same mobile cannot create another customer"));

  const sub = first.subscription;
  checks.push(
    check(
      "Active subscription 2L × ₹60",
      Boolean(sub && sub.dailyQty === 2 && sub.rate === 60 && sub.status === "active"),
      sub ? `${sub.dailyQty} L × ₹${sub.rate}` : "missing subscription",
    ),
  );

  const todayList = listDeliveries(dairyId, today);
  const todayRow = todayList.find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Today’s delivery auto-generated",
      Boolean(todayRow),
      todayRow ? `${todayRow.status} ${todayRow.regularQty} L` : "no delivery row",
    ),
  );

  if (todayRow && todayRow.status === "pending") {
    markDelivered(dairyId, todayRow.id);
  }
  const afterDeliver = listDeliveries(dairyId, today).find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Delivered",
      Boolean(afterDeliver && afterDeliver.status === "delivered" && afterDeliver.deliveredQty === 2 && afterDeliver.amount === 120),
      afterDeliver ? `${afterDeliver.deliveredQty} L / ₹${afterDeliver.amount}` : "missing",
    ),
  );

  const ledger = listLedger(dairyId, today, today, first.id);
  checks.push(
    check(
      "Ledger updated",
      ledger.some((row) => row.date === today && row.deliveredQty === 2 && row.amount === 120),
      `${ledger.length} line(s) today`,
    ),
  );

  const month = Number(today.slice(5, 7));
  const year = Number(today.slice(0, 4));
  const bills = listMonthlyBills(dairyId, year, month);
  const bill = bills.find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Monthly bill updated",
      Boolean(bill && bill.totalDelivered >= 2 && bill.totalAmount >= 120),
      bill ? `${bill.totalDelivered} L / ₹${bill.totalAmount}` : "no bill",
    ),
  );

  const beforePay = getOutstanding(dairyId, first.id);
  if (beforePay > 0 && listPayments(dairyId, first.id).length === 0) {
    recordPayment(dairyId, {
      customerId: first.id,
      date: today,
      amount: 50,
      mode: "cash",
      reference: "TEST-CASH-50",
    });
  }
  const payments = listPayments(dairyId, first.id);
  const outstanding = getOutstanding(dairyId, first.id);
  checks.push(
    check(
      "Payment recorded and balance calculated",
      payments.length > 0 && Number.isFinite(outstanding),
      `paid ${payments[0]?.amount ?? 0}, remaining ₹${outstanding}`,
    ),
  );

  const skipDate = addDays(today, -1);
  ensureDeliveriesForDate(dairyId, skipDate);
  const skipRow = listDeliveries(dairyId, skipDate).find((row) => row.customerId === first.id);
  if (skipRow && skipRow.status === "pending") {
    skipToday(dairyId, skipRow.id, "Out of town");
  }
  const skipped = listDeliveries(dairyId, skipDate).find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Skip today",
      Boolean(skipped && skipped.status === "skipped" && skipped.deliveredQty === 0 && skipped.amount === 0 && skipped.skipReason),
      skipped ? `${skipped.skipReason}` : `no row for ${skipDate} (start date may be today)`,
    ),
  );

  const extraDate = addDays(today, -2);
  ensureDeliveriesForDate(dairyId, extraDate);
  const extraRow = listDeliveries(dairyId, extraDate).find((row) => row.customerId === first.id);
  if (extraRow && extraRow.status === "pending") {
    markExtra(dairyId, extraRow.id, 0.5, "Guest at home");
  }
  const extra = listDeliveries(dairyId, extraDate).find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Extra milk",
      Boolean(extra && extra.status === "extra" && extra.extraQty === 0.5 && extra.deliveredQty === 2.5),
      extra ? `${extra.deliveredQty} L` : `no row for ${extraDate}`,
    ),
  );

  const partialDate = addDays(today, -3);
  ensureDeliveriesForDate(dairyId, partialDate);
  const partialRow = listDeliveries(dairyId, partialDate).find((row) => row.customerId === first.id);
  if (partialRow && partialRow.status === "pending") {
    markPartial(dairyId, partialRow.id, 1, "Half litre only");
  }
  const partial = listDeliveries(dairyId, partialDate).find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Partial delivery",
      Boolean(partial && partial.status === "partial" && partial.deliveredQty === 1 && partial.amount === 60),
      partial ? `${partial.deliveredQty} L / ₹${partial.amount}` : `no row for ${partialDate}`,
    ),
  );

  const pauseFrom = addDays(today, 1);
  const resumeOn = addDays(today, 4);
  pauseCustomer(dairyId, first.id, pauseFrom, resumeOn);
  ensureDeliveriesForDate(dairyId, pauseFrom);
  const pausedList = listDeliveries(dairyId, pauseFrom).filter((row) => row.customerId === first.id && row.status === "pending");
  checks.push(check("Pause hides pending delivery", pausedList.length === 0, `${pauseFrom} pending=${pausedList.length}`));

  resumeCustomer(dairyId, first.id);
  const resumed = getCustomerRow(dairyId, first.id);
  const resumedList = listDeliveries(dairyId, today).find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Resume",
      resumed.status === "active" && Boolean(resumedList),
      `${resumed.status}, today=${resumedList?.status ?? "none"}`,
    ),
  );

  const passed = checks.filter((c) => c.ok).length;
  return {
    ok: checks.every((c) => c.ok),
    passed,
    total: checks.length,
    customer: getCustomerRow(dairyId, first.id),
    checks,
  };
}

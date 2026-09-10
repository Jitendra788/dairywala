import { addDays, todayISO } from "@/lib/dates";
import { DEFAULT_DAIRY_ID } from "@/lib/customers/context";
import {
  createCustomer,
  createWalkInSale,
  ensureDeliveriesForDate,
  getCustomerRow,
  getOutstanding,
  listCustomers,
  listDeliveries,
  listLedger,
  listMonthlyBills,
  listPayments,
  listWalkInSales,
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

export async function runCustomerFlowTest(dairyId = DEFAULT_DAIRY_ID) {
  const today = todayISO();
  const checks: Check[] = [];

  const first = await seedTestCustomer(dairyId);
  const second = await seedTestCustomer(dairyId);
  checks.push(
    check(
      "Customer created once",
      first.id === second.id && first.customerCode === second.customerCode,
      `${first.customerCode} ${first.name} id=${first.id}`,
    ),
  );

  const reused = await createCustomer(dairyId, {
    name: "Ramesh Duplicate",
    mobile: "9876502001",
    address: "Should not save",
    milkType: "buffalo",
    customerType: "regular",
    dailyQty: 2,
    rate: 60,
    startDate: today,
    deliveryTime: "06:30",
    paymentCycle: "monthly",
    status: "active",
  });
  checks.push(
    check(
      "Duplicate mobile reuses same customer",
      reused.id === first.id && (await listCustomers(dairyId)).filter((row) => row.mobile === "9876502001").length === 1,
      `${reused.customerCode} id=${reused.id}`,
    ),
  );

  const sub = first.subscription;
  checks.push(
    check(
      "Active subscription 2L × ₹60",
      Boolean(sub && sub.dailyQty === 2 && sub.rate === 60 && sub.status === "active"),
      sub ? `${sub.dailyQty} L × ₹${sub.rate}` : "missing subscription",
    ),
  );

  const todayList = await listDeliveries(dairyId, today);
  const todayRow = todayList.find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Today’s delivery auto-generated",
      Boolean(todayRow),
      todayRow ? `${todayRow.status} ${todayRow.regularQty} L` : "no delivery row",
    ),
  );

  if (todayRow && todayRow.status === "pending") {
    await markDelivered(dairyId, todayRow.id);
  }
  const afterDeliver = (await listDeliveries(dairyId, today)).find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Delivered",
      Boolean(afterDeliver && afterDeliver.status === "delivered" && afterDeliver.deliveredQty === 2 && afterDeliver.amount === 120),
      afterDeliver ? `${afterDeliver.deliveredQty} L / ₹${afterDeliver.amount}` : "missing",
    ),
  );

  const ledger = await listLedger(dairyId, today, today, first.id);
  checks.push(
    check(
      "Ledger updated",
      ledger.some((row) => row.date === today && row.deliveredQty === 2 && row.amount === 120),
      `${ledger.length} line(s) today`,
    ),
  );

  const month = Number(today.slice(5, 7));
  const year = Number(today.slice(0, 4));
  const bills = await listMonthlyBills(dairyId, year, month);
  const bill = bills.find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Monthly bill updated",
      Boolean(bill && bill.totalDelivered >= 2 && bill.totalAmount >= 120),
      bill ? `${bill.totalDelivered} L / ₹${bill.totalAmount}` : "no bill",
    ),
  );

  const beforePay = await getOutstanding(dairyId, first.id);
  if (beforePay > 0 && (await listPayments(dairyId, first.id)).length === 0) {
    await recordPayment(dairyId, {
      customerId: first.id,
      date: today,
      amount: 50,
      mode: "cash",
      reference: "TEST-CASH-50",
    });
  }
  const payments = await listPayments(dairyId, first.id);
  const outstanding = await getOutstanding(dairyId, first.id);
  checks.push(
    check(
      "Payment recorded and balance calculated",
      payments.length > 0 && Number.isFinite(outstanding),
      `paid ${payments[0]?.amount ?? 0}, remaining ₹${outstanding}`,
    ),
  );

  const skipDate = addDays(today, -1);
  await ensureDeliveriesForDate(dairyId, skipDate);
  const skipRow = (await listDeliveries(dairyId, skipDate)).find((row) => row.customerId === first.id);
  if (skipRow && skipRow.status === "pending") {
    await skipToday(dairyId, skipRow.id, "Out of town");
  }
  const skipped = (await listDeliveries(dairyId, skipDate)).find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Skip today",
      Boolean(skipped && skipped.status === "skipped" && skipped.deliveredQty === 0 && skipped.amount === 0 && skipped.skipReason),
      skipped ? `${skipped.skipReason}` : `no row for ${skipDate} (start date may be today)`,
    ),
  );

  const extraDate = addDays(today, -2);
  await ensureDeliveriesForDate(dairyId, extraDate);
  const extraRow = (await listDeliveries(dairyId, extraDate)).find((row) => row.customerId === first.id);
  if (extraRow && extraRow.status === "pending") {
    await markExtra(dairyId, extraRow.id, 0.5, "Guest at home");
  }
  const extra = (await listDeliveries(dairyId, extraDate)).find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Extra milk",
      Boolean(extra && extra.status === "extra" && extra.extraQty === 0.5 && extra.deliveredQty === 2.5),
      extra ? `${extra.deliveredQty} L` : `no row for ${extraDate}`,
    ),
  );

  const partialDate = addDays(today, -3);
  await ensureDeliveriesForDate(dairyId, partialDate);
  const partialRow = (await listDeliveries(dairyId, partialDate)).find((row) => row.customerId === first.id);
  if (partialRow && partialRow.status === "pending") {
    await markPartial(dairyId, partialRow.id, 1, "Half litre only");
  }
  const partial = (await listDeliveries(dairyId, partialDate)).find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Partial delivery",
      Boolean(partial && partial.status === "partial" && partial.deliveredQty === 1 && partial.amount === 60),
      partial ? `${partial.deliveredQty} L / ₹${partial.amount}` : `no row for ${partialDate}`,
    ),
  );

  const pauseFrom = addDays(today, 1);
  const resumeOn = addDays(today, 4);
  await pauseCustomer(dairyId, first.id, pauseFrom, resumeOn);
  await ensureDeliveriesForDate(dairyId, pauseFrom);
  const pausedList = (await listDeliveries(dairyId, pauseFrom)).filter((row) => row.customerId === first.id && row.status === "pending");
  checks.push(check("Pause hides pending delivery", pausedList.length === 0, `${pauseFrom} pending=${pausedList.length}`));

  await resumeCustomer(dairyId, first.id);
  const resumed = await getCustomerRow(dairyId, first.id);
  const resumedList = (await listDeliveries(dairyId, today)).find((row) => row.customerId === first.id);
  checks.push(
    check(
      "Resume",
      resumed.status === "active" && Boolean(resumedList),
      `${resumed.status}, today=${resumedList?.status ?? "none"}`,
    ),
  );

  const walkinMobile = "9876502012";
  const existingWalkin = (await listCustomers(dairyId)).find((row) => row.mobile === walkinMobile);
  const walkin =
    existingWalkin ??
    await createCustomer(dairyId, {
      name: "Walk-in Ramesh",
      mobile: walkinMobile,
      address: "",
      milkType: "cow",
      customerType: "walkin",
      status: "active",
    });
  const beforeCount = (await listCustomers(dairyId)).filter((row) => row.mobile === walkinMobile).length;
  const monthPrefix = today.slice(0, 8);
  const dayA = `${monthPrefix}01`;
  const dayB = `${monthPrefix}03`;
  const dayC = `${monthPrefix}02`;
  await createWalkInSale(dairyId, {
    customerId: walkin.id,
    date: dayA,
    milkType: "cow",
    quantity: 3,
    rate: 60,
    paymentStatus: "paid",
    paymentMode: "cash",
  });
  await createWalkInSale(dairyId, {
    customerId: walkin.id,
    date: dayB,
    milkType: "cow",
    quantity: 5,
    rate: 60,
    paymentStatus: "pending",
    paymentMode: "cash",
  });
  const afterCount = (await listCustomers(dairyId)).filter((row) => row.mobile === walkinMobile).length;
  const walkinLedger = await listLedger(dairyId, dayA, dayB, walkin.id);
  const quietLedger = await listLedger(dairyId, dayC, dayC, walkin.id);
  const autoOnDesk = (await listDeliveries(dairyId, today)).some((row) => row.customerId === walkin.id);
  const walkinBills = await listMonthlyBills(dairyId, Number(dayA.slice(0, 4)), Number(dayA.slice(5, 7)));
  const walkinBill = walkinBills.find((row) => row.customerId === walkin.id);
  const walkinOutstanding = await getOutstanding(dairyId, walkin.id);
  checks.push(check("Walk-in stays one customer master", beforeCount === 1 && afterCount === 1, `${walkin.customerCode} records=${afterCount}`));
  checks.push(
    check(
      "Two dated walk-in transactions",
      walkinLedger.filter((row) => row.date === dayA || row.date === dayB).length === 2 &&
        walkinLedger.some((row) => row.date === dayA && row.deliveredQty === 3 && row.amount === 180) &&
        walkinLedger.some((row) => row.date === dayB && row.deliveredQty === 5 && row.amount === 300),
      `${walkinLedger.length} ledger lines`,
    ),
  );
  checks.push(check("No charge on a day without purchase", quietLedger.length === 0, `${dayC} lines=${quietLedger.length}`));
  checks.push(check("Walk-in not auto-listed on daily delivery", !autoOnDesk, autoOnDesk ? "appeared" : "hidden"));
  checks.push(
    check(
      "Monthly bill uses only actual walk-in sales",
      Boolean(walkinBill && walkinBill.totalDelivered >= 8 && walkinBill.totalAmount >= 480),
      walkinBill ? `${walkinBill.totalDelivered} L / ₹${walkinBill.totalAmount}` : "no bill",
    ),
  );
  checks.push(check("Pending walk-in sale increases outstanding", walkinOutstanding >= 300, `outstanding ₹${walkinOutstanding}`));
  checks.push(check("Walk-in sales list for sale date", (await listWalkInSales(dairyId, dayA)).some((row) => row.customerId === walkin.id), dayA));

  let pauseBlocked = false;
  try {
    await pauseCustomer(dairyId, walkin.id, today, addDays(today, 2));
  } catch (error) {
    pauseBlocked = error instanceof Error && /no daily subscription/i.test(error.message);
  }
  checks.push(check("Walk-in cannot be paused like a subscription", pauseBlocked, "pause rejected"));

  const passed = checks.filter((c) => c.ok).length;
  return {
    ok: checks.every((c) => c.ok),
    passed,
    total: checks.length,
    customer: await getCustomerRow(dairyId, first.id),
    checks,
  };
}

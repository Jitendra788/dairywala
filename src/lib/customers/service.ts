import { randomUUID } from "node:crypto";
import { addDays, todayISO } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { assertDairy, getDb } from "@/lib/customers/db";
import { CustomerError } from "@/lib/customers/errors";
import type {
  BillRow,
  CreateCustomerInput,
  Customer,
  CustomerMilkType,
  CustomerPayment,
  CustomerRow,
  CustomerStatus,
  CustomerSubscription,
  DailyMilkDelivery,
  DeliveryRow,
  DeliveryStatus,
  LedgerRow,
  MonthlyBill,
  PaymentCycle,
  PaymentMode,
  PaymentRow,
  UpdateCustomerInput,
} from "@/lib/customers/types";
import {
  CUSTOMER_STATUSES,
  DELIVERY_STATUSES,
  MILK_TYPES,
  PAYMENT_CYCLES,
  PAYMENT_MODES,
} from "@/lib/customers/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

function nowISO() {
  return new Date().toISOString();
}

function asRecord(row: Record<string, unknown> | undefined) {
  return row ?? null;
}

function num(value: unknown) {
  return typeof value === "number" ? value : Number(value || 0);
}

function str(value: unknown) {
  return value == null ? "" : String(value);
}

function nullable(value: unknown) {
  return value == null || value === "" ? null : String(value);
}

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: str(row.id),
    dairyId: str(row.dairyId),
    customerCode: str(row.customerCode),
    name: str(row.name),
    mobile: str(row.mobile),
    address: str(row.address),
    milkType: str(row.milkType) as CustomerMilkType,
    status: str(row.status) as CustomerStatus,
    createdAt: str(row.createdAt),
    updatedAt: str(row.updatedAt),
  };
}

function mapSubscription(row: Record<string, unknown>): CustomerSubscription {
  return {
    id: str(row.id),
    dairyId: str(row.dairyId),
    customerId: str(row.customerId),
    dailyQty: num(row.dailyQty),
    rate: num(row.rate),
    startDate: str(row.startDate),
    deliveryTime: str(row.deliveryTime),
    paymentCycle: str(row.paymentCycle) as PaymentCycle,
    pauseFrom: nullable(row.pauseFrom),
    resumeDate: nullable(row.resumeDate),
    status: str(row.status) as CustomerStatus,
    createdAt: str(row.createdAt),
    updatedAt: str(row.updatedAt),
  };
}

function mapDelivery(row: Record<string, unknown>): DailyMilkDelivery {
  return {
    id: str(row.id),
    dairyId: str(row.dairyId),
    customerId: str(row.customerId),
    date: str(row.date),
    regularQty: num(row.regularQty),
    extraQty: num(row.extraQty),
    deliveredQty: num(row.deliveredQty),
    rate: num(row.rate),
    amount: num(row.amount),
    status: str(row.status) as DeliveryStatus,
    skipReason: nullable(row.skipReason),
    notes: nullable(row.notes),
    createdAt: str(row.createdAt),
    updatedAt: str(row.updatedAt),
  };
}

function mapLedger(row: Record<string, unknown>) {
  return {
    id: str(row.id),
    dairyId: str(row.dairyId),
    customerId: str(row.customerId),
    date: str(row.date),
    regularQty: num(row.regularQty),
    extraQty: num(row.extraQty),
    deliveredQty: num(row.deliveredQty),
    rate: num(row.rate),
    amount: num(row.amount),
    status: str(row.status) as DeliveryStatus,
    deliveryId: str(row.deliveryId),
    createdAt: str(row.createdAt),
  };
}

function mapPayment(row: Record<string, unknown>): CustomerPayment {
  return {
    id: str(row.id),
    dairyId: str(row.dairyId),
    customerId: str(row.customerId),
    date: str(row.date),
    amount: num(row.amount),
    mode: str(row.mode) as PaymentMode,
    reference: str(row.reference),
    remainingBalance: num(row.remainingBalance),
    createdAt: str(row.createdAt),
  };
}

function mapBill(row: Record<string, unknown>): MonthlyBill {
  return {
    id: str(row.id),
    dairyId: str(row.dairyId),
    customerId: str(row.customerId),
    year: num(row.year),
    month: num(row.month),
    totalDelivered: num(row.totalDelivered),
    totalAmount: num(row.totalAmount),
    skippedDays: num(row.skippedDays),
    extraMilk: num(row.extraMilk),
    paidAmount: num(row.paidAmount),
    outstanding: num(row.outstanding),
    updatedAt: str(row.updatedAt),
  };
}

function requireDairy(dairyId: string) {
  assertDairy(dairyId);
}

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function cleanMobile(value: string) {
  return value.replace(/\D/g, "");
}

function validateDate(value: string, label: string) {
  if (!DATE_RE.test(value)) throw new CustomerError(`${label} is invalid`);
}

function nextCustomerCode(dairyId: string) {
  const row = getDb()
    .prepare(
      `SELECT customerCode FROM Customer WHERE dairyId = ? ORDER BY customerCode DESC LIMIT 1`,
    )
    .get(dairyId);
  const last = row ? str(row.customerCode) : "";
  const n = last.match(/^CUS-(\d+)$/) ? Number(RegExp.$1) + 1 : 1001;
  return `CUS-${String(n).padStart(4, "0")}`;
}

export function peekNextCustomerCode(dairyId: string) {
  requireDairy(dairyId);
  return nextCustomerCode(dairyId);
}

export function isPausedOn(sub: CustomerSubscription, date: string) {
  if (sub.status === "stopped") return false;
  if (!sub.pauseFrom) return sub.status === "paused";
  if (date < sub.pauseFrom) return false;
  if (sub.resumeDate && date >= sub.resumeDate) return false;
  return true;
}

function getCustomer(dairyId: string, customerId: string) {
  const row = asRecord(
    getDb()
      .prepare(`SELECT * FROM Customer WHERE dairyId = ? AND id = ?`)
      .get(dairyId, customerId),
  );
  if (!row) throw new CustomerError("Customer not found", 404);
  return mapCustomer(row);
}

function getSubscription(dairyId: string, customerId: string) {
  const row = asRecord(
    getDb()
      .prepare(`SELECT * FROM CustomerSubscription WHERE dairyId = ? AND customerId = ?`)
      .get(dairyId, customerId),
  );
  return row ? mapSubscription(row) : null;
}

export function getOutstanding(dairyId: string, customerId: string) {
  const billed = num(
    getDb()
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS t FROM MilkLedger WHERE dairyId = ? AND customerId = ?`)
      .get(dairyId, customerId)?.t,
  );
  const paid = num(
    getDb()
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS t FROM CustomerPayment WHERE dairyId = ? AND customerId = ?`)
      .get(dairyId, customerId)?.t,
  );
  return round2(billed - paid);
}

function upsertLedger(delivery: DailyMilkDelivery) {
  const existing = asRecord(
    getDb()
      .prepare(`SELECT id FROM MilkLedger WHERE dairyId = ? AND deliveryId = ?`)
      .get(delivery.dairyId, delivery.id),
  );
  if (existing) {
    getDb()
      .prepare(
        `UPDATE MilkLedger SET date = ?, regularQty = ?, extraQty = ?, deliveredQty = ?, rate = ?, amount = ?, status = ? WHERE id = ? AND dairyId = ?`,
      )
      .run(
        delivery.date,
        delivery.regularQty,
        delivery.extraQty,
        delivery.deliveredQty,
        delivery.rate,
        delivery.amount,
        delivery.status,
        str(existing.id),
        delivery.dairyId,
      );
    return;
  }
  getDb()
    .prepare(
      `INSERT INTO MilkLedger (id, dairyId, customerId, date, regularQty, extraQty, deliveredQty, rate, amount, status, deliveryId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      delivery.dairyId,
      delivery.customerId,
      delivery.date,
      delivery.regularQty,
      delivery.extraQty,
      delivery.deliveredQty,
      delivery.rate,
      delivery.amount,
      delivery.status,
      delivery.id,
      nowISO(),
    );
}

export function refreshMonthlyBill(dairyId: string, customerId: string, date: string) {
  const [year, month] = date.split("-").map(Number);
  const from = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const to =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const agg = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('delivered','partial','extra') THEN deliveredQty ELSE 0 END), 0) AS totalDelivered,
         COALESCE(SUM(amount), 0) AS totalAmount,
         COALESCE(SUM(CASE WHEN status IN ('skipped','not_delivered') THEN 1 ELSE 0 END), 0) AS skippedDays,
         COALESCE(SUM(extraQty), 0) AS extraMilk
       FROM MilkLedger
       WHERE dairyId = ? AND customerId = ? AND date >= ? AND date < ?`,
    )
    .get(dairyId, customerId, from, to);

  const paid = num(
    getDb()
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS t FROM CustomerPayment
         WHERE dairyId = ? AND customerId = ? AND date >= ? AND date < ?`,
      )
      .get(dairyId, customerId, from, to)?.t,
  );

  const totalDelivered = round2(num(agg?.totalDelivered));
  const totalAmount = round2(num(agg?.totalAmount));
  const skippedDays = num(agg?.skippedDays);
  const extraMilk = round2(num(agg?.extraMilk));
  const paidAmount = round2(paid);
  const outstanding = round2(totalAmount - paidAmount);
  const updatedAt = nowISO();

  const existing = asRecord(
    getDb()
      .prepare(`SELECT id FROM MonthlyBill WHERE dairyId = ? AND customerId = ? AND year = ? AND month = ?`)
      .get(dairyId, customerId, year, month),
  );

  if (existing) {
    getDb()
      .prepare(
        `UPDATE MonthlyBill SET totalDelivered = ?, totalAmount = ?, skippedDays = ?, extraMilk = ?, paidAmount = ?, outstanding = ?, updatedAt = ? WHERE id = ?`,
      )
      .run(
        totalDelivered,
        totalAmount,
        skippedDays,
        extraMilk,
        paidAmount,
        outstanding,
        updatedAt,
        str(existing.id),
      );
    return getMonthlyBill(dairyId, str(existing.id));
  }

  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO MonthlyBill (id, dairyId, customerId, year, month, totalDelivered, totalAmount, skippedDays, extraMilk, paidAmount, outstanding, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      dairyId,
      customerId,
      year,
      month,
      totalDelivered,
      totalAmount,
      skippedDays,
      extraMilk,
      paidAmount,
      outstanding,
      updatedAt,
    );
  return getMonthlyBill(dairyId, id);
}

function getMonthlyBill(dairyId: string, id: string) {
  const row = asRecord(
    getDb().prepare(`SELECT * FROM MonthlyBill WHERE dairyId = ? AND id = ?`).get(dairyId, id),
  );
  if (!row) throw new CustomerError("Bill not found", 404);
  return mapBill(row);
}

function validateCreate(input: CreateCustomerInput) {
  const name = cleanName(input.name || "");
  const mobile = cleanMobile(input.mobile || "");
  const address = cleanName(input.address || "");
  if (name.length < 2) throw new CustomerError("Customer name is required");
  if (!MOBILE_RE.test(mobile)) throw new CustomerError("Enter a valid 10-digit mobile");
  if (address.length < 3) throw new CustomerError("Address is required");
  if (!MILK_TYPES.includes(input.milkType)) throw new CustomerError("Choose a milk type");
  if (!Number.isFinite(input.dailyQty) || input.dailyQty <= 0) {
    throw new CustomerError("Daily quantity must be greater than 0");
  }
  if (!Number.isFinite(input.rate) || input.rate <= 0) {
    throw new CustomerError("Milk rate must be greater than 0");
  }
  validateDate(input.startDate, "Delivery start date");
  if (!TIME_RE.test(input.deliveryTime)) throw new CustomerError("Delivery time is invalid");
  if (!PAYMENT_CYCLES.includes(input.paymentCycle)) throw new CustomerError("Choose a payment cycle");
  if (!CUSTOMER_STATUSES.includes(input.status)) throw new CustomerError("Choose a status");
  return {
    name,
    mobile,
    address,
    milkType: input.milkType,
    dailyQty: round2(input.dailyQty),
    rate: round2(input.rate),
    startDate: input.startDate,
    deliveryTime: input.deliveryTime,
    paymentCycle: input.paymentCycle,
    status: input.status,
  };
}

export function createCustomer(dairyId: string, raw: CreateCustomerInput) {
  requireDairy(dairyId);
  const input = validateCreate(raw);
  const existing = asRecord(
    getDb()
      .prepare(`SELECT id FROM Customer WHERE dairyId = ? AND mobile = ?`)
      .get(dairyId, input.mobile),
  );
  if (existing) {
    throw new CustomerError("This mobile already has a customer. Do not create the same customer again.");
  }

  const id = randomUUID();
  const code = nextCustomerCode(dairyId);
  const ts = nowISO();
  getDb()
    .prepare(
      `INSERT INTO Customer (id, dairyId, customerCode, name, mobile, address, milkType, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, dairyId, code, input.name, input.mobile, input.address, input.milkType, input.status, ts, ts);

  getDb()
    .prepare(
      `INSERT INTO CustomerSubscription (id, dairyId, customerId, dailyQty, rate, startDate, deliveryTime, paymentCycle, pauseFrom, resumeDate, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      dairyId,
      id,
      input.dailyQty,
      input.rate,
      input.startDate,
      input.deliveryTime,
      input.paymentCycle,
      input.status,
      ts,
      ts,
    );

  ensureDeliveriesForDate(dairyId, todayISO());
  return getCustomerRow(dairyId, id);
}

export function updateCustomer(dairyId: string, customerId: string, raw: UpdateCustomerInput) {
  requireDairy(dairyId);
  const customer = getCustomer(dairyId, customerId);
  const sub = getSubscription(dairyId, customerId);
  if (!sub) throw new CustomerError("Subscription missing for this customer", 409);

  const name = raw.name != null ? cleanName(raw.name) : customer.name;
  const mobile = raw.mobile != null ? cleanMobile(raw.mobile) : customer.mobile;
  const address = raw.address != null ? cleanName(raw.address) : customer.address;
  const milkType = raw.milkType ?? customer.milkType;
  const dailyQty = raw.dailyQty != null ? round2(raw.dailyQty) : sub.dailyQty;
  const rate = raw.rate != null ? round2(raw.rate) : sub.rate;
  const deliveryTime = raw.deliveryTime ?? sub.deliveryTime;
  const paymentCycle = raw.paymentCycle ?? sub.paymentCycle;
  const status = raw.status ?? customer.status;

  if (name.length < 2) throw new CustomerError("Customer name is required");
  if (!MOBILE_RE.test(mobile)) throw new CustomerError("Enter a valid 10-digit mobile");
  if (address.length < 3) throw new CustomerError("Address is required");
  if (!MILK_TYPES.includes(milkType)) throw new CustomerError("Choose a milk type");
  if (dailyQty <= 0) throw new CustomerError("Daily quantity must be greater than 0");
  if (rate <= 0) throw new CustomerError("Milk rate must be greater than 0");
  if (!TIME_RE.test(deliveryTime)) throw new CustomerError("Delivery time is invalid");
  if (!PAYMENT_CYCLES.includes(paymentCycle)) throw new CustomerError("Choose a payment cycle");
  if (!CUSTOMER_STATUSES.includes(status)) throw new CustomerError("Choose a status");

  const clash = asRecord(
    getDb()
      .prepare(`SELECT id FROM Customer WHERE dairyId = ? AND mobile = ? AND id != ?`)
      .get(dairyId, mobile, customerId),
  );
  if (clash) throw new CustomerError("Another customer already uses this mobile");

  const ts = nowISO();
  getDb()
    .prepare(
      `UPDATE Customer SET name = ?, mobile = ?, address = ?, milkType = ?, status = ?, updatedAt = ? WHERE dairyId = ? AND id = ?`,
    )
    .run(name, mobile, address, milkType, status, ts, dairyId, customerId);

  getDb()
    .prepare(
      `UPDATE CustomerSubscription SET dailyQty = ?, rate = ?, deliveryTime = ?, paymentCycle = ?, status = ?, updatedAt = ? WHERE dairyId = ? AND customerId = ?`,
    )
    .run(dailyQty, rate, deliveryTime, paymentCycle, status, ts, dairyId, customerId);

  if (status === "stopped") {
    getDb()
      .prepare(
        `DELETE FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND status = 'pending'`,
      )
      .run(dairyId, customerId);
  } else {
    ensureDeliveriesForDate(dairyId, todayISO());
  }

  return getCustomerRow(dairyId, customerId);
}

export function pauseCustomer(
  dairyId: string,
  customerId: string,
  pauseFrom: string,
  resumeDate: string,
) {
  requireDairy(dairyId);
  getCustomer(dairyId, customerId);
  validateDate(pauseFrom, "Pause from");
  validateDate(resumeDate, "Resume date");
  if (resumeDate <= pauseFrom) throw new CustomerError("Resume date must be after pause from");

  const ts = nowISO();
  getDb()
    .prepare(
      `UPDATE CustomerSubscription SET pauseFrom = ?, resumeDate = ?, status = 'paused', updatedAt = ? WHERE dairyId = ? AND customerId = ?`,
    )
    .run(pauseFrom, resumeDate, ts, dairyId, customerId);
  getDb()
    .prepare(`UPDATE Customer SET status = 'paused', updatedAt = ? WHERE dairyId = ? AND id = ?`)
    .run(ts, dairyId, customerId);

  getDb()
    .prepare(
      `DELETE FROM DailyMilkDelivery
       WHERE dairyId = ? AND customerId = ? AND status = 'pending'
         AND date >= ? AND date < ?`,
    )
    .run(dairyId, customerId, pauseFrom, resumeDate);

  return getCustomerRow(dairyId, customerId);
}

export function resumeCustomer(dairyId: string, customerId: string) {
  requireDairy(dairyId);
  getCustomer(dairyId, customerId);
  const ts = nowISO();
  getDb()
    .prepare(
      `UPDATE CustomerSubscription SET pauseFrom = NULL, resumeDate = NULL, status = 'active', updatedAt = ? WHERE dairyId = ? AND customerId = ?`,
    )
    .run(ts, dairyId, customerId);
  getDb()
    .prepare(`UPDATE Customer SET status = 'active', updatedAt = ? WHERE dairyId = ? AND id = ?`)
    .run(ts, dairyId, customerId);
  ensureDeliveriesForDate(dairyId, todayISO());
  return getCustomerRow(dairyId, customerId);
}

export function getCustomerRow(dairyId: string, customerId: string): CustomerRow {
  const customer = getCustomer(dairyId, customerId);
  const today = todayISO();
  const deliveryRow = asRecord(
    getDb()
      .prepare(`SELECT * FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ?`)
      .get(dairyId, customerId, today),
  );
  return {
    ...customer,
    subscription: getSubscription(dairyId, customerId),
    todayDelivery: deliveryRow ? mapDelivery(deliveryRow) : null,
    outstanding: getOutstanding(dairyId, customerId),
  };
}

export function listCustomers(dairyId: string): CustomerRow[] {
  requireDairy(dairyId);
  ensureDeliveriesForDate(dairyId, todayISO());
  const rows = getDb()
    .prepare(`SELECT * FROM Customer WHERE dairyId = ? ORDER BY customerCode ASC`)
    .all(dairyId);
  return rows.map((row) => getCustomerRow(dairyId, str(row.id)));
}

export function ensureDeliveriesForDate(dairyId: string, date: string) {
  requireDairy(dairyId);
  validateDate(date, "Date");
  const subs = getDb()
    .prepare(
      `SELECT s.*, c.status AS customerStatus
       FROM CustomerSubscription s
       JOIN Customer c ON c.id = s.customerId
       WHERE s.dairyId = ? AND s.startDate <= ? AND c.status != 'stopped' AND s.status != 'stopped'`,
    )
    .all(dairyId, date);

  let created = 0;
  for (const raw of subs) {
    const sub = mapSubscription(raw);
    if (isPausedOn(sub, date)) {
      getDb()
        .prepare(
          `DELETE FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ? AND status = 'pending'`,
        )
        .run(dairyId, sub.customerId, date);
      continue;
    }

    const existing = asRecord(
      getDb()
        .prepare(`SELECT id FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ?`)
        .get(dairyId, sub.customerId, date),
    );
    if (existing) continue;

    const ts = nowISO();
    getDb()
      .prepare(
        `INSERT INTO DailyMilkDelivery (id, dairyId, customerId, date, regularQty, extraQty, deliveredQty, rate, amount, status, skipReason, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, 'pending', NULL, NULL, ?, ?)`,
      )
      .run(randomUUID(), dairyId, sub.customerId, date, sub.dailyQty, sub.rate, ts, ts);
    created += 1;
  }
  return created;
}

export function listDeliveries(dairyId: string, date: string): DeliveryRow[] {
  requireDairy(dairyId);
  ensureDeliveriesForDate(dairyId, date);
  const rows = getDb()
    .prepare(
      `SELECT d.* FROM DailyMilkDelivery d
       JOIN Customer c ON c.id = d.customerId
       JOIN CustomerSubscription s ON s.customerId = d.customerId
       WHERE d.dairyId = ? AND d.date = ?
         AND NOT (
           d.status = 'pending' AND (
             (s.pauseFrom IS NOT NULL AND d.date >= s.pauseFrom AND (s.resumeDate IS NULL OR d.date < s.resumeDate))
             OR c.status = 'paused'
           )
         )
       ORDER BY c.name ASC`,
    )
    .all(dairyId, date);

  return rows.map((row) => {
    const delivery = mapDelivery(row);
    return {
      ...delivery,
      customer: getCustomer(dairyId, delivery.customerId),
      subscription: getSubscription(dairyId, delivery.customerId),
    };
  });
}

function getOwnedDelivery(dairyId: string, deliveryId: string) {
  const row = asRecord(
    getDb().prepare(`SELECT * FROM DailyMilkDelivery WHERE dairyId = ? AND id = ?`).get(dairyId, deliveryId),
  );
  if (!row) throw new CustomerError("Delivery not found", 404);
  return mapDelivery(row);
}

function finalizeDelivery(
  dairyId: string,
  deliveryId: string,
  patch: {
    status: DeliveryStatus;
    deliveredQty: number;
    extraQty: number;
    amount: number;
    skipReason?: string | null;
    notes?: string | null;
  },
) {
  if (!DELIVERY_STATUSES.includes(patch.status)) throw new CustomerError("Invalid delivery status");
  const current = getOwnedDelivery(dairyId, deliveryId);
  const ts = nowISO();
  getDb()
    .prepare(
      `UPDATE DailyMilkDelivery
       SET extraQty = ?, deliveredQty = ?, amount = ?, status = ?, skipReason = ?, notes = ?, updatedAt = ?
       WHERE dairyId = ? AND id = ?`,
    )
    .run(
      patch.extraQty,
      patch.deliveredQty,
      patch.amount,
      patch.status,
      patch.skipReason ?? null,
      patch.notes ?? null,
      ts,
      dairyId,
      deliveryId,
    );
  const next = getOwnedDelivery(dairyId, deliveryId);
  upsertLedger(next);
  refreshMonthlyBill(dairyId, current.customerId, current.date);
  return {
    ...next,
    customer: getCustomer(dairyId, next.customerId),
    subscription: getSubscription(dairyId, next.customerId),
  } satisfies DeliveryRow;
}

export function markDelivered(dairyId: string, deliveryId: string) {
  const current = getOwnedDelivery(dairyId, deliveryId);
  const deliveredQty = round2(current.regularQty + current.extraQty);
  return finalizeDelivery(dairyId, deliveryId, {
    status: current.extraQty > 0 ? "extra" : "delivered",
    deliveredQty,
    extraQty: current.extraQty,
    amount: round2(deliveredQty * current.rate),
    skipReason: null,
    notes: current.notes,
  });
}

export function skipToday(dairyId: string, deliveryId: string, reason: string) {
  const note = cleanName(reason);
  if (note.length < 2) throw new CustomerError("Skip reason is required");
  getOwnedDelivery(dairyId, deliveryId);
  return finalizeDelivery(dairyId, deliveryId, {
    status: "skipped",
    deliveredQty: 0,
    extraQty: 0,
    amount: 0,
    skipReason: note,
    notes: note,
  });
}

export function markNotDelivered(dairyId: string, deliveryId: string, reason?: string) {
  getOwnedDelivery(dairyId, deliveryId);
  return finalizeDelivery(dairyId, deliveryId, {
    status: "not_delivered",
    deliveredQty: 0,
    extraQty: 0,
    amount: 0,
    skipReason: reason ? cleanName(reason) : "Not delivered",
    notes: reason ? cleanName(reason) : "Not delivered",
  });
}

export function markPartial(dairyId: string, deliveryId: string, qty: number, notes?: string) {
  const current = getOwnedDelivery(dairyId, deliveryId);
  if (!Number.isFinite(qty) || qty <= 0) throw new CustomerError("Partial quantity must be greater than 0");
  if (qty >= current.regularQty) {
    throw new CustomerError("Partial quantity must be less than the regular daily quantity");
  }
  return finalizeDelivery(dairyId, deliveryId, {
    status: "partial",
    deliveredQty: round2(qty),
    extraQty: 0,
    amount: round2(qty * current.rate),
    skipReason: null,
    notes: notes ? cleanName(notes) : "Partial delivery",
  });
}

export function markExtra(dairyId: string, deliveryId: string, extraQty: number, notes?: string) {
  const current = getOwnedDelivery(dairyId, deliveryId);
  if (!Number.isFinite(extraQty) || extraQty <= 0) throw new CustomerError("Extra milk must be greater than 0");
  const deliveredQty = round2(current.regularQty + extraQty);
  return finalizeDelivery(dairyId, deliveryId, {
    status: "extra",
    deliveredQty,
    extraQty: round2(extraQty),
    amount: round2(deliveredQty * current.rate),
    skipReason: null,
    notes: notes ? cleanName(notes) : "Extra milk",
  });
}

export function listLedger(dairyId: string, from: string, to: string, customerId?: string): LedgerRow[] {
  requireDairy(dairyId);
  validateDate(from, "From date");
  validateDate(to, "To date");
  if (to < from) throw new CustomerError("To date must be on or after from date");
  const rows = customerId
    ? getDb()
        .prepare(
          `SELECT * FROM MilkLedger WHERE dairyId = ? AND customerId = ? AND date >= ? AND date <= ? ORDER BY date DESC, createdAt DESC`,
        )
        .all(dairyId, customerId, from, to)
    : getDb()
        .prepare(
          `SELECT * FROM MilkLedger WHERE dairyId = ? AND date >= ? AND date <= ? ORDER BY date DESC, createdAt DESC`,
        )
        .all(dairyId, from, to);
  return rows.map((row) => ({
    ...mapLedger(row),
    customer: getCustomer(dairyId, str(row.customerId)),
  }));
}

export function listMonthlyBills(dairyId: string, year: number, month: number): BillRow[] {
  requireDairy(dairyId);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) {
    throw new CustomerError("Invalid month");
  }
  const customers = getDb()
    .prepare(`SELECT id FROM Customer WHERE dairyId = ?`)
    .all(dairyId);
  const date = `${year}-${String(month).padStart(2, "0")}-01`;
  for (const row of customers) {
    refreshMonthlyBill(dairyId, str(row.id), date);
  }
  const bills = getDb()
    .prepare(
      `SELECT * FROM MonthlyBill WHERE dairyId = ? AND year = ? AND month = ? ORDER BY customerId ASC`,
    )
    .all(dairyId, year, month);
  return bills
    .map((row) => {
      const bill = mapBill(row);
      return { ...bill, customer: getCustomer(dairyId, bill.customerId) };
    })
    .filter((bill) => bill.totalDelivered > 0 || bill.skippedDays > 0 || bill.paidAmount > 0);
}

export function recordPayment(
  dairyId: string,
  input: { customerId: string; date: string; amount: number; mode: PaymentMode; reference?: string },
): PaymentRow {
  requireDairy(dairyId);
  const customer = getCustomer(dairyId, input.customerId);
  validateDate(input.date, "Payment date");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new CustomerError("Payment amount must be greater than 0");
  }
  if (!PAYMENT_MODES.includes(input.mode)) throw new CustomerError("Choose a payment mode");
  const remaining = round2(getOutstanding(dairyId, customer.id) - input.amount);
  const id = randomUUID();
  const ts = nowISO();
  getDb()
    .prepare(
      `INSERT INTO CustomerPayment (id, dairyId, customerId, date, amount, mode, reference, remainingBalance, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      dairyId,
      customer.id,
      input.date,
      round2(input.amount),
      input.mode,
      cleanName(input.reference || ""),
      remaining,
      ts,
    );
  refreshMonthlyBill(dairyId, customer.id, input.date);
  const row = asRecord(
    getDb().prepare(`SELECT * FROM CustomerPayment WHERE dairyId = ? AND id = ?`).get(dairyId, id),
  );
  if (!row) throw new CustomerError("Payment failed", 500);
  return { ...mapPayment(row), customer };
}

export function listPayments(dairyId: string, customerId?: string): PaymentRow[] {
  requireDairy(dairyId);
  const rows = customerId
    ? getDb()
        .prepare(`SELECT * FROM CustomerPayment WHERE dairyId = ? AND customerId = ? ORDER BY date DESC, createdAt DESC`)
        .all(dairyId, customerId)
    : getDb()
        .prepare(`SELECT * FROM CustomerPayment WHERE dairyId = ? ORDER BY date DESC, createdAt DESC`)
        .all(dairyId);
  return rows.map((row) => ({
    ...mapPayment(row),
    customer: getCustomer(dairyId, str(row.customerId)),
  }));
}

export function seedTestCustomer(dairyId: string) {
  requireDairy(dairyId);
  const startDate = addDays(todayISO(), -7);
  const existing = asRecord(
    getDb()
      .prepare(`SELECT id FROM Customer WHERE dairyId = ? AND mobile = ?`)
      .get(dairyId, "9876502001"),
  );
  if (existing) {
    getDb()
      .prepare(
        `UPDATE CustomerSubscription SET startDate = ? WHERE dairyId = ? AND customerId = ? AND startDate > ?`,
      )
      .run(startDate, dairyId, str(existing.id), startDate);
    return getCustomerRow(dairyId, str(existing.id));
  }
  return createCustomer(dairyId, {
    name: "Ramesh",
    mobile: "9876502001",
    address: "Near temple, Village Road",
    milkType: "buffalo",
    dailyQty: 2,
    rate: 60,
    startDate,
    deliveryTime: "06:30",
    paymentCycle: "monthly",
    status: "active",
  });
}

export function countCustomers(dairyId: string) {
  return num(
    getDb().prepare(`SELECT COUNT(*) AS t FROM Customer WHERE dairyId = ?`).get(dairyId)?.t,
  );
}

export { addDays };

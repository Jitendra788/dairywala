import { randomUUID } from "node:crypto";
import { addDays, todayISO } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { assertDairy, getDb } from "@/lib/customers/db";
import { CustomerError } from "@/lib/customers/errors";
import type {
  BillRow,
  CreateCustomerInput,
  Customer,
  CustomerDashboardStats,
  CustomerMilkType,
  CustomerPayment,
  CustomerRow,
  CustomerStatus,
  CustomerSubscription,
  CustomerType,
  DailyMilkDelivery,
  DeliveryRow,
  DeliveryStatus,
  LedgerRow,
  MonthlyBill,
  PaymentCycle,
  PaymentMode,
  PaymentRow,
  SalePaymentStatus,
  UpdateCustomerInput,
  WalkInSaleInput,
  WalkInTotals,
} from "@/lib/customers/types";
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  DELIVERY_STATUSES,
  MILK_TYPES,
  PAYMENT_CYCLES,
  PAYMENT_MODES,
  SALE_PAYMENT_STATUSES,
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
    mobile: storedMobile(row.mobile),
    address: str(row.address),
    milkType: str(row.milkType) as CustomerMilkType,
    customerType: (str(row.customerType) === "walkin" ? "walkin" : "regular") as CustomerType,
    defaultQty: num(row.defaultQty),
    defaultRate: num(row.defaultRate),
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
    milkType: MILK_TYPES.includes(str(row.milkType) as CustomerMilkType)
      ? (str(row.milkType) as CustomerMilkType)
      : null,
    source: str(row.source) === "walkin" ? "walkin" : "subscription",
    paymentStatus: SALE_PAYMENT_STATUSES.includes(str(row.paymentStatus) as SalePaymentStatus)
      ? (str(row.paymentStatus) as SalePaymentStatus)
      : null,
    paymentMode: PAYMENT_MODES.includes(str(row.paymentMode) as PaymentMode)
      ? (str(row.paymentMode) as PaymentMode)
      : null,
    paidAmount: num(row.paidAmount),
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
  const digits = value.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function optionalMobile(value: string) {
  const mobile = cleanMobile(value);
  if (!mobile) return "";
  if (!MOBILE_RE.test(mobile)) throw new CustomerError("Enter a valid 10-digit mobile, or leave it blank");
  return mobile;
}

const BLANK_MOBILE = "__blank:";

function storedMobile(value: unknown) {
  const mobile = str(value);
  return !mobile || mobile.startsWith(BLANK_MOBILE) ? "" : mobile;
}

function mobileDb(mobile: string) {
  return mobile || `${BLANK_MOBILE}${randomUUID()}`;
}

export function findCustomerByMobile(dairyId: string, mobile: string) {
  const normalized = cleanMobile(mobile);
  if (!normalized) return null;
  const row = asRecord(
    getDb()
      .prepare(
        `SELECT * FROM Customer
         WHERE dairyId = ?
           AND (mobile = ? OR substr(replace(mobile, ' ', ''), -10) = ?)
         ORDER BY CASE WHEN IFNULL(customerType, 'regular') = 'regular' THEN 0 ELSE 1 END, createdAt ASC
         LIMIT 1`,
      )
      .get(dairyId, normalized, normalized),
  );
  return row ? mapCustomer(row) : null;
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
  const mobile = optionalMobile(input.mobile || "");
  const address = cleanName(input.address || "");
  const customerType: CustomerType = input.customerType === "walkin" ? "walkin" : "regular";
  const status = input.status && CUSTOMER_STATUSES.includes(input.status) ? input.status : "active";
  if (name.length < 2) throw new CustomerError("Customer name is required");
  if (customerType === "regular" && address.length < 3) throw new CustomerError("Address is required");
  if (!MILK_TYPES.includes(input.milkType)) throw new CustomerError("Choose a milk type");
  if (!CUSTOMER_TYPES.includes(customerType)) throw new CustomerError("Choose a customer type");
  if (customerType === "walkin") {
    return {
      name,
      mobile,
      address,
      milkType: input.milkType,
      customerType,
      dailyQty: 0,
      rate: Number.isFinite(input.rate) ? round2(input.rate || 0) : 0,
      startDate: todayISO(),
      deliveryTime: "06:30",
      paymentCycle: "monthly" as PaymentCycle,
      status,
    };
  }
  if (!Number.isFinite(input.dailyQty) || (input.dailyQty ?? 0) <= 0) {
    throw new CustomerError("Daily quantity must be greater than 0");
  }
  if (!Number.isFinite(input.rate) || (input.rate ?? 0) <= 0) {
    throw new CustomerError("Milk rate must be greater than 0");
  }
  validateDate(input.startDate || "", "Delivery start date");
  if (!TIME_RE.test(input.deliveryTime || "")) throw new CustomerError("Delivery time is invalid");
  if (!input.paymentCycle || !PAYMENT_CYCLES.includes(input.paymentCycle)) {
    throw new CustomerError("Choose a payment cycle");
  }
  return {
    name,
    mobile,
    address,
    milkType: input.milkType,
    customerType,
    dailyQty: round2(input.dailyQty || 0),
    rate: round2(input.rate || 0),
    startDate: input.startDate || todayISO(),
    deliveryTime: input.deliveryTime || "06:30",
    paymentCycle: input.paymentCycle,
    status,
  };
}

function insertSubscription(
  dairyId: string,
  customerId: string,
  input: {
    dailyQty: number;
    rate: number;
    startDate: string;
    deliveryTime: string;
    paymentCycle: PaymentCycle;
    status: CustomerStatus;
  },
  ts: string,
) {
  getDb()
    .prepare(
      `INSERT INTO CustomerSubscription (id, dairyId, customerId, dailyQty, rate, startDate, deliveryTime, paymentCycle, pauseFrom, resumeDate, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      dairyId,
      customerId,
      input.dailyQty,
      input.rate,
      input.startDate,
      input.deliveryTime,
      input.paymentCycle,
      input.status,
      ts,
      ts,
    );
}

function reuseOrPromoteCustomer(
  dairyId: string,
  existingId: string,
  input: ReturnType<typeof validateCreate>,
) {
  const existing = getCustomer(dairyId, existingId);
  if (input.customerType === "walkin" || existing.customerType === "regular") {
    return getCustomerRow(dairyId, existing.id);
  }

  const ts = nowISO();
  getDb()
    .prepare(
      `UPDATE Customer
       SET name = ?, mobile = ?, address = ?, milkType = ?, customerType = 'regular', defaultQty = ?, defaultRate = ?, status = ?, updatedAt = ?
       WHERE dairyId = ? AND id = ?`,
    )
    .run(
      input.name || existing.name,
      mobileDb(input.mobile),
      input.address || existing.address,
      input.milkType,
      input.dailyQty,
      input.rate,
      input.status,
      ts,
      dairyId,
      existing.id,
    );
  if (!getSubscription(dairyId, existing.id)) {
    insertSubscription(dairyId, existing.id, input, ts);
  }
  ensureDeliveriesForDate(dairyId, todayISO());
  return getCustomerRow(dairyId, existing.id);
}

export function createCustomer(dairyId: string, raw: CreateCustomerInput) {
  requireDairy(dairyId);
  const input = validateCreate(raw);
  const existing = input.mobile ? findCustomerByMobile(dairyId, input.mobile) : null;
  if (existing) {
    return reuseOrPromoteCustomer(dairyId, existing.id, input);
  }

  const id = randomUUID();
  const code = nextCustomerCode(dairyId);
  const ts = nowISO();
  getDb()
    .prepare(
      `INSERT INTO Customer (id, dairyId, customerCode, name, mobile, address, milkType, customerType, defaultQty, defaultRate, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      dairyId,
      code,
      input.name,
      mobileDb(input.mobile),
      input.address,
      input.milkType,
      input.customerType,
      input.dailyQty,
      input.rate,
      input.status,
      ts,
      ts,
    );

  if (input.customerType === "regular") {
    insertSubscription(dairyId, id, input, ts);
    ensureDeliveriesForDate(dairyId, todayISO());
  }
  return getCustomerRow(dairyId, id);
}

export function updateCustomer(dairyId: string, customerId: string, raw: UpdateCustomerInput) {
  requireDairy(dairyId);
  const customer = getCustomer(dairyId, customerId);
  const sub = getSubscription(dairyId, customerId);
  if (customer.customerType === "regular" && !sub) {
    throw new CustomerError("Subscription missing for this customer", 409);
  }

  const name = raw.name != null ? cleanName(raw.name) : customer.name;
  const mobile = raw.mobile != null ? optionalMobile(raw.mobile) : customer.mobile;
  const address = raw.address != null ? cleanName(raw.address) : customer.address;
  const milkType = raw.milkType ?? customer.milkType;
  const dailyQty = raw.dailyQty != null ? round2(raw.dailyQty) : sub?.dailyQty ?? 0;
  const rate = raw.rate != null ? round2(raw.rate) : sub?.rate ?? 0;
  const deliveryTime = raw.deliveryTime ?? sub?.deliveryTime ?? "06:30";
  const paymentCycle = raw.paymentCycle ?? sub?.paymentCycle ?? "monthly";
  const status = raw.status ?? customer.status;

  if (name.length < 2) throw new CustomerError("Customer name is required");
  if (customer.customerType === "regular" && address.length < 3) throw new CustomerError("Address is required");
  if (!MILK_TYPES.includes(milkType)) throw new CustomerError("Choose a milk type");
  if (customer.customerType === "regular" && dailyQty <= 0) throw new CustomerError("Daily quantity must be greater than 0");
  if (customer.customerType === "regular" && rate <= 0) throw new CustomerError("Milk rate must be greater than 0");
  if (customer.customerType === "regular" && !TIME_RE.test(deliveryTime)) throw new CustomerError("Delivery time is invalid");
  if (customer.customerType === "regular" && !PAYMENT_CYCLES.includes(paymentCycle)) throw new CustomerError("Choose a payment cycle");
  if (!CUSTOMER_STATUSES.includes(status)) throw new CustomerError("Choose a status");

  const clash = mobile ? findCustomerByMobile(dairyId, mobile) : null;
  if (clash && clash.id !== customerId) throw new CustomerError("Another customer already uses this mobile");

  const ts = nowISO();
  const defaultQty = raw.dailyQty != null ? dailyQty : customer.defaultQty || dailyQty;
  const defaultRate = raw.rate != null ? rate : customer.defaultRate || rate;
  getDb()
    .prepare(
      `UPDATE Customer SET name = ?, mobile = ?, address = ?, milkType = ?, defaultQty = ?, defaultRate = ?, status = ?, updatedAt = ? WHERE dairyId = ? AND id = ?`,
    )
    .run(name, mobileDb(mobile), address, milkType, defaultQty, defaultRate, status, ts, dairyId, customerId);

  if (customer.customerType === "walkin") {
    return getCustomerRow(dairyId, customerId);
  }

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
  const customer = getCustomer(dairyId, customerId);
  if (customer.customerType === "walkin") {
    throw new CustomerError("Walk-in customers have no daily subscription to pause");
  }
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
  const customer = getCustomer(dairyId, customerId);
  if (customer.customerType === "walkin") {
    throw new CustomerError("Walk-in customers have no daily subscription to resume");
  }
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
  try {
    ensureDeliveriesForDate(dairyId, todayISO());
  } catch {
    // still return the customer master list
  }
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
      `SELECT s.*, c.status AS customerStatus, c.milkType AS customerMilkType
       FROM CustomerSubscription s
       JOIN Customer c ON c.id = s.customerId
       WHERE s.dairyId = ? AND s.startDate <= ? AND c.status != 'stopped' AND s.status != 'stopped'
         AND IFNULL(c.customerType, 'regular') = 'regular'`,
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
    const milkType = MILK_TYPES.includes(str(raw.customerMilkType) as CustomerMilkType)
      ? str(raw.customerMilkType)
      : "cow";
    try {
      getDb()
        .prepare(
          `INSERT OR IGNORE INTO DailyMilkDelivery (id, dairyId, customerId, date, regularQty, extraQty, deliveredQty, rate, amount, status, skipReason, notes, milkType, source, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, 'pending', NULL, NULL, ?, 'subscription', ?, ?)`,
        )
        .run(randomUUID(), dairyId, sub.customerId, date, sub.dailyQty, sub.rate, milkType, ts, ts);
      created += 1;
    } catch {
      // another request already created today's row
    }
  }
  return created;
}

export function listDeliveries(dairyId: string, date: string): DeliveryRow[] {
  requireDairy(dairyId);
  try {
    ensureDeliveriesForDate(dairyId, date);
  } catch {
    // still return any rows already saved for this date
  }
  const rows = getDb()
    .prepare(
      `SELECT d.* FROM DailyMilkDelivery d
       JOIN Customer c ON c.id = d.customerId
       JOIN CustomerSubscription s ON s.customerId = d.customerId
       WHERE d.dairyId = ? AND d.date = ?
         AND IFNULL(d.source, 'subscription') = 'subscription'
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

export function listLedger(
  dairyId: string,
  from: string,
  to: string,
  customerId?: string,
  filters?: { customerType?: CustomerType; milkType?: CustomerMilkType; paymentStatus?: SalePaymentStatus },
): LedgerRow[] {
  requireDairy(dairyId);
  validateDate(from, "From date");
  validateDate(to, "To date");
  if (to < from) throw new CustomerError("To date must be on or after from date");
  const rows = getDb()
    .prepare(
      `SELECT l.*, IFNULL(d.milkType, c.milkType) AS rowMilkType, d.paymentStatus AS salePaymentStatus
       FROM MilkLedger l
       JOIN Customer c ON c.id = l.customerId
       LEFT JOIN DailyMilkDelivery d ON d.id = l.deliveryId
       WHERE l.dairyId = ? AND l.date >= ? AND l.date <= ?
         AND (? IS NULL OR l.customerId = ?)
         AND (? IS NULL OR IFNULL(c.customerType, 'regular') = ?)
         AND (? IS NULL OR IFNULL(d.milkType, c.milkType) = ?)
         AND (? IS NULL OR IFNULL(d.paymentStatus, '') = ?)
       ORDER BY l.date DESC, l.createdAt DESC`,
    )
    .all(
      dairyId,
      from,
      to,
      customerId ?? null,
      customerId ?? null,
      filters?.customerType ?? null,
      filters?.customerType ?? null,
      filters?.milkType ?? null,
      filters?.milkType ?? null,
      filters?.paymentStatus ?? null,
      filters?.paymentStatus ?? null,
    );
  const outstandingByCustomer = new Map<string, number>();
  return rows.map((row) => {
    const customerId = str(row.customerId);
    if (!outstandingByCustomer.has(customerId)) {
      outstandingByCustomer.set(customerId, getOutstanding(dairyId, customerId));
    }
    const milkType = MILK_TYPES.includes(str(row.rowMilkType) as CustomerMilkType)
      ? (str(row.rowMilkType) as CustomerMilkType)
      : "cow";
    const paymentStatus = SALE_PAYMENT_STATUSES.includes(str(row.salePaymentStatus) as SalePaymentStatus)
      ? (str(row.salePaymentStatus) as SalePaymentStatus)
      : null;
    return {
      ...mapLedger(row),
      customer: getCustomer(dairyId, customerId),
      milkType,
      paymentStatus,
      outstanding: outstandingByCustomer.get(customerId) ?? 0,
    };
  });
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
  const existing = findCustomerByMobile(dairyId, "9876502001");
  if (existing) {
    try {
      getDb()
        .prepare(
          `UPDATE CustomerSubscription SET startDate = ? WHERE dairyId = ? AND customerId = ? AND startDate > ?`,
        )
        .run(startDate, dairyId, existing.id, startDate);
    } catch {
      // walk-in or missing subscription — keep the master record
    }
    return getCustomerRow(dairyId, existing.id);
  }
  return createCustomer(dairyId, {
    name: "Ramesh",
    mobile: "9876502001",
    address: "Near temple, Village Road",
    milkType: "buffalo",
    customerType: "regular",
    dailyQty: 2,
    rate: 60,
    startDate,
    deliveryTime: "06:30",
    paymentCycle: "monthly",
    status: "active",
  });
}

function rememberWalkInDefaults(
  dairyId: string,
  customerId: string,
  milkType: CustomerMilkType,
  qty: number,
  rate: number,
) {
  getDb()
    .prepare(
      `UPDATE Customer SET milkType = ?, defaultQty = ?, defaultRate = ?, updatedAt = ? WHERE dairyId = ? AND id = ?`,
    )
    .run(milkType, qty, rate, nowISO(), dairyId, customerId);
}

function walkInPaymentRef(deliveryId: string) {
  return `walkin:${deliveryId}`;
}

function syncWalkInPayment(dairyId: string, customerId: string, date: string, deliveryId: string, paidAmount: number, mode: PaymentMode) {
  getDb()
    .prepare(`DELETE FROM CustomerPayment WHERE dairyId = ? AND reference = ?`)
    .run(dairyId, walkInPaymentRef(deliveryId));
  if (paidAmount > 0) {
    recordPayment(dairyId, {
      customerId,
      date,
      amount: paidAmount,
      mode,
      reference: walkInPaymentRef(deliveryId),
    });
  }
}

function resolvePaidAmount(amount: number, status: SalePaymentStatus, paidAmount?: number) {
  if (status === "paid") return amount;
  if (status === "pending") return 0;
  const paid = round2(paidAmount ?? 0);
  if (paid <= 0 || paid >= amount) {
    throw new CustomerError("Partial payment must be more than 0 and less than the sale amount");
  }
  return paid;
}

export function createWalkInSale(dairyId: string, raw: WalkInSaleInput): DeliveryRow {
  requireDairy(dairyId);
  const customer = getCustomer(dairyId, raw.customerId);
  if (customer.customerType !== "walkin") {
    throw new CustomerError("Use Daily Milk Delivery for regular subscription customers");
  }
  if (customer.status === "stopped") throw new CustomerError("This customer is stopped");
  validateDate(raw.date, "Sale date");
  if (!MILK_TYPES.includes(raw.milkType)) throw new CustomerError("Choose a milk type");
  if (!Number.isFinite(raw.quantity) || raw.quantity <= 0) throw new CustomerError("Quantity must be greater than 0");
  if (!Number.isFinite(raw.rate) || raw.rate < 0) throw new CustomerError("Rate cannot be negative");
  if (!SALE_PAYMENT_STATUSES.includes(raw.paymentStatus)) throw new CustomerError("Choose a payment status");
  const mode = raw.paymentMode && PAYMENT_MODES.includes(raw.paymentMode) ? raw.paymentMode : "cash";
  const qty = round2(raw.quantity);
  const rate = round2(raw.rate);
  const amount = round2(qty * rate);
  const paidAmount = resolvePaidAmount(amount, raw.paymentStatus, raw.paidAmount);
  if (paidAmount > amount) throw new CustomerError("Payment amount cannot exceed the sale amount");

  const existing = asRecord(
    getDb()
      .prepare(`SELECT * FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ?`)
      .get(dairyId, customer.id, raw.date),
  );
  const ts = nowISO();
  const notes = raw.notes ? cleanName(raw.notes) : null;

  if (existing) {
    const current = mapDelivery(existing);
    if (current.source !== "walkin") {
      throw new CustomerError("This date already has a subscription delivery for the customer");
    }
    return updateWalkInSale(dairyId, current.id, raw);
  }

  const id = randomUUID();
  try {
    getDb()
      .prepare(
        `INSERT INTO DailyMilkDelivery (id, dairyId, customerId, date, regularQty, extraQty, deliveredQty, rate, amount, status, skipReason, notes, milkType, source, paymentStatus, paymentMode, paidAmount, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'delivered', NULL, ?, ?, 'walkin', ?, ?, ?, ?, ?)`,
      )
      .run(id, dairyId, customer.id, raw.date, qty, qty, rate, amount, notes, raw.milkType, raw.paymentStatus, mode, paidAmount, ts, ts);
  } catch (error) {
    const existingNow = asRecord(
      getDb()
        .prepare(`SELECT * FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ?`)
        .get(dairyId, customer.id, raw.date),
    );
    if (existingNow) return updateWalkInSale(dairyId, str(existingNow.id), raw);
    throw error;
  }

  rememberWalkInDefaults(dairyId, customer.id, raw.milkType, qty, rate);
  const saved = getOwnedDelivery(dairyId, id);
  upsertLedger(saved);
  refreshMonthlyBill(dairyId, customer.id, raw.date);
  syncWalkInPayment(dairyId, customer.id, raw.date, id, paidAmount, mode);
  return {
    ...getOwnedDelivery(dairyId, id),
    customer: getCustomer(dairyId, customer.id),
    subscription: null,
  };
}

export function updateWalkInSale(dairyId: string, deliveryId: string, raw: Partial<WalkInSaleInput> & Pick<WalkInSaleInput, "quantity" | "rate" | "paymentStatus">): DeliveryRow {
  requireDairy(dairyId);
  const current = getOwnedDelivery(dairyId, deliveryId);
  if (current.source !== "walkin") throw new CustomerError("This is not a walk-in sale");
  const customer = getCustomer(dairyId, current.customerId);
  const milkType = raw.milkType && MILK_TYPES.includes(raw.milkType) ? raw.milkType : customer.milkType;
  if (!Number.isFinite(raw.quantity) || raw.quantity <= 0) throw new CustomerError("Quantity must be greater than 0");
  if (!Number.isFinite(raw.rate) || raw.rate < 0) throw new CustomerError("Rate cannot be negative");
  if (!SALE_PAYMENT_STATUSES.includes(raw.paymentStatus)) throw new CustomerError("Choose a payment status");
  const mode = raw.paymentMode && PAYMENT_MODES.includes(raw.paymentMode) ? raw.paymentMode : current.paymentMode ?? "cash";
  const qty = round2(raw.quantity);
  const rate = round2(raw.rate);
  const amount = round2(qty * rate);
  const paidAmount = resolvePaidAmount(amount, raw.paymentStatus, raw.paidAmount);
  const notes = raw.notes != null ? cleanName(raw.notes) || null : current.notes;
  const ts = nowISO();

  rememberWalkInDefaults(dairyId, customer.id, milkType, qty, rate);

  getDb()
    .prepare(
      `UPDATE DailyMilkDelivery
       SET regularQty = ?, deliveredQty = ?, rate = ?, amount = ?, notes = ?, milkType = ?, paymentStatus = ?, paymentMode = ?, paidAmount = ?, updatedAt = ?
       WHERE dairyId = ? AND id = ?`,
    )
    .run(qty, qty, rate, amount, notes, milkType, raw.paymentStatus, mode, paidAmount, ts, dairyId, deliveryId);

  const next = getOwnedDelivery(dairyId, deliveryId);
  upsertLedger(next);
  refreshMonthlyBill(dairyId, customer.id, current.date);
  syncWalkInPayment(dairyId, customer.id, current.date, deliveryId, paidAmount, mode);
  return {
    ...getOwnedDelivery(dairyId, deliveryId),
    customer: getCustomer(dairyId, customer.id),
    subscription: null,
  };
}

export function deleteWalkInSale(dairyId: string, deliveryId: string) {
  requireDairy(dairyId);
  const current = getOwnedDelivery(dairyId, deliveryId);
  if (current.source !== "walkin") throw new CustomerError("Only walk-in sales can be deleted here");
  getDb().prepare(`DELETE FROM MilkLedger WHERE dairyId = ? AND deliveryId = ?`).run(dairyId, deliveryId);
  getDb().prepare(`DELETE FROM CustomerPayment WHERE dairyId = ? AND reference = ?`).run(dairyId, walkInPaymentRef(deliveryId));
  getDb().prepare(`DELETE FROM DailyMilkDelivery WHERE dairyId = ? AND id = ?`).run(dairyId, deliveryId);
  refreshMonthlyBill(dairyId, current.customerId, current.date);
  return { ok: true };
}

export function listWalkInSales(dairyId: string, date: string): DeliveryRow[] {
  requireDairy(dairyId);
  validateDate(date, "Date");
  const rows = getDb()
    .prepare(
      `SELECT d.* FROM DailyMilkDelivery d
       JOIN Customer c ON c.id = d.customerId
       WHERE d.dairyId = ? AND d.date = ? AND IFNULL(d.source, 'subscription') = 'walkin'
       ORDER BY d.createdAt DESC`,
    )
    .all(dairyId, date);
  return rows.map((row) => {
    const delivery = mapDelivery(row);
    return {
      ...delivery,
      customer: getCustomer(dairyId, delivery.customerId),
      subscription: null,
    };
  });
}

export function walkInTotals(dairyId: string, date: string): WalkInTotals {
  const sales = listWalkInSales(dairyId, date);
  const qty = round2(sales.reduce((s, r) => s + r.deliveredQty, 0));
  const total = round2(sales.reduce((s, r) => s + r.amount, 0));
  const paid = round2(sales.reduce((s, r) => s + r.paidAmount, 0));
  return {
    customers: new Set(sales.map((r) => r.customerId)).size,
    qty,
    sales: total,
    paid,
    pending: round2(total - paid),
  };
}

export function searchCustomers(dairyId: string, query: string, type?: CustomerType): CustomerRow[] {
  requireDairy(dairyId);
  const q = query.trim();
  if (!q && !type) return [];
  const rows = getDb()
    .prepare(
      `SELECT * FROM Customer
       WHERE dairyId = ?
         AND (? IS NULL OR IFNULL(customerType, 'regular') = ?)
         AND (
           ? = ''
           OR lower(name) LIKE ?
           OR mobile LIKE ?
           OR lower(customerCode) LIKE ?
         )
       ORDER BY name ASC
       LIMIT 40`,
    )
    .all(
      dairyId,
      type ?? null,
      type ?? null,
      q,
      `%${q.toLowerCase()}%`,
      `%${q}%`,
      `%${q.toLowerCase()}%`,
    );
  return rows.map((row) => getCustomerRow(dairyId, str(row.id)));
}

export function customerDashboardStats(dairyId: string, date: string): CustomerDashboardStats {
  requireDairy(dairyId);
  validateDate(date, "Date");
  const counts = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN IFNULL(customerType, 'regular') = 'regular' THEN 1 ELSE 0 END), 0) AS regular,
         COALESCE(SUM(CASE WHEN customerType = 'walkin' THEN 1 ELSE 0 END), 0) AS walkin,
         COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active
       FROM Customer WHERE dairyId = ?`,
    )
    .get(dairyId);
  const sales = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('delivered','partial','extra') THEN deliveredQty ELSE 0 END), 0) AS qty,
         COALESCE(SUM(CASE WHEN status IN ('delivered','partial','extra') THEN amount ELSE 0 END), 0) AS sales,
         COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'walkin' THEN deliveredQty ELSE 0 END), 0) AS walkInQty,
         COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'walkin' THEN amount ELSE 0 END), 0) AS walkInSales,
         COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'subscription' AND status IN ('delivered','partial','extra') THEN deliveredQty ELSE 0 END), 0) AS regularQty,
         COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'subscription' AND status IN ('delivered','partial','extra') THEN amount ELSE 0 END), 0) AS regularSales
       FROM DailyMilkDelivery WHERE dairyId = ? AND date = ?`,
    )
    .get(dairyId, date);
  const pending = getDb()
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(outstanding), 0) AS amount FROM (
         SELECT
           COALESCE((SELECT SUM(amount) FROM MilkLedger l WHERE l.dairyId = c.dairyId AND l.customerId = c.id), 0)
           - COALESCE((SELECT SUM(amount) FROM CustomerPayment p WHERE p.dairyId = c.dairyId AND p.customerId = c.id), 0)
           AS outstanding
         FROM Customer c
         WHERE c.dairyId = ?
       ) x WHERE outstanding > 0.005`,
    )
    .get(dairyId);

  return {
    date,
    customers: {
      total: num(counts?.total),
      regular: num(counts?.regular),
      walkin: num(counts?.walkin),
      active: num(counts?.active),
    },
    today: {
      qty: round2(num(sales?.qty)),
      sales: round2(num(sales?.sales)),
      walkInQty: round2(num(sales?.walkInQty)),
      walkInSales: round2(num(sales?.walkInSales)),
      regularQty: round2(num(sales?.regularQty)),
      regularSales: round2(num(sales?.regularSales)),
    },
    pending: {
      count: num(pending?.n),
      amount: round2(num(pending?.amount)),
    },
  };
}

export function countCustomers(dairyId: string) {
  return num(
    getDb().prepare(`SELECT COUNT(*) AS t FROM Customer WHERE dairyId = ?`).get(dairyId)?.t,
  );
}

export { addDays };

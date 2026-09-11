import { randomUUID } from "node:crypto";
import { addDays, todayISO } from "@/lib/dates";
import { round2 } from "@/lib/money";
import { assertDairy, qall, qget, qrun } from "@/lib/customers/db";
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

async function requireDairy(dairyId: string) {
  await assertDairy(dairyId);
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

export async function findCustomerByMobile(dairyId: string, mobile: string) {
  const normalized = cleanMobile(mobile);
  if (!normalized) return null;
  const row = asRecord(
    await qget(`SELECT * FROM Customer
         WHERE dairyId = ?
           AND (mobile = ? OR substr(replace(mobile, ' ', ''), -10) = ?)
         ORDER BY CASE WHEN IFNULL(customerType, 'regular') = 'regular' THEN 0 ELSE 1 END, createdAt ASC
         LIMIT 1`, dairyId, normalized, normalized),
  );
  return row ? mapCustomer(row) : null;
}

function validateDate(value: string, label: string) {
  if (!DATE_RE.test(value)) throw new CustomerError(`${label} is invalid`);
}

async function nextCustomerCode(dairyId: string) {
  const row = await qget(`SELECT customerCode FROM Customer WHERE dairyId = ? ORDER BY customerCode DESC LIMIT 1`, dairyId);
  const last = row ? str(row.customerCode) : "";
  const n = last.match(/^CUS-(\d+)$/) ? Number(RegExp.$1) + 1 : 1001;
  return `CUS-${String(n).padStart(4, "0")}`;
}

export async function peekNextCustomerCode(dairyId: string) {
  await requireDairy(dairyId);
  return await nextCustomerCode(dairyId);
}

export function isPausedOn(sub: CustomerSubscription, date: string) {
  if (sub.status === "stopped") return false;
  if (!sub.pauseFrom) return sub.status === "paused";
  if (date < sub.pauseFrom) return false;
  if (sub.resumeDate && date >= sub.resumeDate) return false;
  return true;
}

async function getCustomer(dairyId: string, customerId: string) {
  const key = customerId.trim();
  const row = asRecord(
    await qget(`SELECT * FROM Customer WHERE dairyId = ? AND (id = ? OR customerCode = ?) LIMIT 1`, dairyId, key, key),
  );
  if (!row) throw new CustomerError("Customer not found", 404);
  return mapCustomer(row);
}

async function getSubscription(dairyId: string, customerId: string) {
  const row = asRecord(
    await qget(`SELECT * FROM CustomerSubscription WHERE dairyId = ? AND customerId = ?`, dairyId, customerId),
  );
  return row ? mapSubscription(row) : null;
}

export async function getOutstanding(dairyId: string, customerId: string) {
  const billed = num(
    (await qget(`SELECT COALESCE(SUM(amount), 0) AS t FROM MilkLedger WHERE dairyId = ? AND customerId = ?`, dairyId, customerId))?.t,
  );
  const paid = num(
    (await qget(`SELECT COALESCE(SUM(amount), 0) AS t FROM CustomerPayment WHERE dairyId = ? AND customerId = ?`, dairyId, customerId))?.t,
  );
  return round2(billed - paid);
}

async function upsertLedger(delivery: DailyMilkDelivery) {
  const existing = asRecord(
    await qget(`SELECT id FROM MilkLedger WHERE dairyId = ? AND deliveryId = ?`, delivery.dairyId, delivery.id),
  );
  if (existing) {
    await qrun(`UPDATE MilkLedger SET date = ?, regularQty = ?, extraQty = ?, deliveredQty = ?, rate = ?, amount = ?, status = ? WHERE id = ? AND dairyId = ?`, delivery.date,
        delivery.regularQty,
        delivery.extraQty,
        delivery.deliveredQty,
        delivery.rate,
        delivery.amount,
        delivery.status,
        str(existing.id),
        delivery.dairyId,);
    return;
  }
  await qrun(`INSERT INTO MilkLedger (id, dairyId, customerId, date, regularQty, extraQty, deliveredQty, rate, amount, status, deliveryId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, randomUUID(),
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
      nowISO(),);
}

export async function refreshMonthlyBill(dairyId: string, customerId: string, date: string) {
  const [year, month] = date.split("-").map(Number);
  const from = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const to =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const agg = await qget(`SELECT
         COALESCE(SUM(CASE WHEN status IN ('delivered','partial','extra') THEN deliveredQty ELSE 0 END), 0) AS totalDelivered,
         COALESCE(SUM(amount), 0) AS totalAmount,
         COALESCE(SUM(CASE WHEN status IN ('skipped','not_delivered') THEN 1 ELSE 0 END), 0) AS skippedDays,
         COALESCE(SUM(extraQty), 0) AS extraMilk
       FROM MilkLedger
       WHERE dairyId = ? AND customerId = ? AND date >= ? AND date < ?`, dairyId, customerId, from, to);

  const paid = num(
    (await qget(`SELECT COALESCE(SUM(amount), 0) AS t FROM CustomerPayment
         WHERE dairyId = ? AND customerId = ? AND date >= ? AND date < ?`, dairyId, customerId, from, to))?.t,
  );

  const totalDelivered = round2(num(agg?.totalDelivered));
  const totalAmount = round2(num(agg?.totalAmount));
  const skippedDays = num(agg?.skippedDays);
  const extraMilk = round2(num(agg?.extraMilk));
  const paidAmount = round2(paid);
  const outstanding = round2(totalAmount - paidAmount);
  const updatedAt = nowISO();

  const existing = asRecord(
    await qget(`SELECT id FROM MonthlyBill WHERE dairyId = ? AND customerId = ? AND year = ? AND month = ?`, dairyId, customerId, year, month),
  );

  if (existing) {
    await qrun(`UPDATE MonthlyBill SET totalDelivered = ?, totalAmount = ?, skippedDays = ?, extraMilk = ?, paidAmount = ?, outstanding = ?, updatedAt = ? WHERE id = ?`, totalDelivered,
        totalAmount,
        skippedDays,
        extraMilk,
        paidAmount,
        outstanding,
        updatedAt,
        str(existing.id),);
    return await getMonthlyBill(dairyId, str(existing.id));
  }

  const id = randomUUID();
  await qrun(`INSERT INTO MonthlyBill (id, dairyId, customerId, year, month, totalDelivered, totalAmount, skippedDays, extraMilk, paidAmount, outstanding, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id,
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
      updatedAt,);
  return await getMonthlyBill(dairyId, id);
}

async function getMonthlyBill(dairyId: string, id: string) {
  const row = asRecord(
    await qget(`SELECT * FROM MonthlyBill WHERE dairyId = ? AND id = ?`, dairyId, id),
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

async function insertSubscription(
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
  await qrun(`INSERT INTO CustomerSubscription (id, dairyId, customerId, dailyQty, rate, startDate, deliveryTime, paymentCycle, pauseFrom, resumeDate, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`, randomUUID(),
      dairyId,
      customerId,
      input.dailyQty,
      input.rate,
      input.startDate,
      input.deliveryTime,
      input.paymentCycle,
      input.status,
      ts,
      ts,);
}

async function reuseOrPromoteCustomer(
  dairyId: string,
  existingId: string,
  input: ReturnType<typeof validateCreate>,
) {
  const existing = await getCustomer(dairyId, existingId);
  if (input.customerType === "walkin" || existing.customerType === "regular") {
    return await getCustomerRow(dairyId, existing.id);
  }

  const ts = nowISO();
  await qrun(`UPDATE Customer
       SET name = ?, mobile = ?, address = ?, milkType = ?, customerType = 'regular', defaultQty = ?, defaultRate = ?, status = ?, updatedAt = ?
       WHERE dairyId = ? AND id = ?`, input.name || existing.name,
      mobileDb(input.mobile),
      input.address || existing.address,
      input.milkType,
      input.dailyQty,
      input.rate,
      input.status,
      ts,
      dairyId,
      existing.id,);
  if (!await getSubscription(dairyId, existing.id)) {
    await insertSubscription(dairyId, existing.id, input, ts);
  }
  await ensureDeliveriesForDate(dairyId, todayISO());
  return await getCustomerRow(dairyId, existing.id);
}

export async function createCustomer(dairyId: string, raw: CreateCustomerInput) {
  await requireDairy(dairyId);
  const input = validateCreate(raw);
  const existing = input.mobile ? await findCustomerByMobile(dairyId, input.mobile) : null;
  if (existing) {
    return await reuseOrPromoteCustomer(dairyId, existing.id, input);
  }

  const id = randomUUID();
  const code = await nextCustomerCode(dairyId);
  const ts = nowISO();
  await qrun(`INSERT INTO Customer (id, dairyId, customerCode, name, mobile, address, milkType, customerType, defaultQty, defaultRate, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id,
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
      ts,);

  if (input.customerType === "regular") {
    await insertSubscription(dairyId, id, input, ts);
    await ensureDeliveriesForDate(dairyId, todayISO());
  }
  return await getCustomerRow(dairyId, id);
}

export async function updateCustomer(dairyId: string, customerId: string, raw: UpdateCustomerInput) {
  await requireDairy(dairyId);
  const customer = await getCustomer(dairyId, customerId);
  const sub = await getSubscription(dairyId, customerId);
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

  const clash = mobile ? await findCustomerByMobile(dairyId, mobile) : null;
  if (clash && clash.id !== customerId) throw new CustomerError("Another customer already uses this mobile");

  const ts = nowISO();
  const defaultQty = raw.dailyQty != null ? dailyQty : customer.defaultQty || dailyQty;
  const defaultRate = raw.rate != null ? rate : customer.defaultRate || rate;
  await qrun(`UPDATE Customer SET name = ?, mobile = ?, address = ?, milkType = ?, defaultQty = ?, defaultRate = ?, status = ?, updatedAt = ? WHERE dairyId = ? AND id = ?`, name, mobileDb(mobile), address, milkType, defaultQty, defaultRate, status, ts, dairyId, customerId);

  if (customer.customerType === "walkin") {
    return await getCustomerRow(dairyId, customerId);
  }

  await qrun(`UPDATE CustomerSubscription SET dailyQty = ?, rate = ?, deliveryTime = ?, paymentCycle = ?, status = ?, updatedAt = ? WHERE dairyId = ? AND customerId = ?`, dailyQty, rate, deliveryTime, paymentCycle, status, ts, dairyId, customerId);

  if (status === "stopped") {
    await qrun(`DELETE FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND status = 'pending'`, dairyId, customerId);
  } else {
    await ensureDeliveriesForDate(dairyId, todayISO());
  }

  return await getCustomerRow(dairyId, customerId);
}

export async function pauseCustomer(
  dairyId: string,
  customerId: string,
  pauseFrom: string,
  resumeDate: string,
) {
  await requireDairy(dairyId);
  const customer = await getCustomer(dairyId, customerId);
  if (customer.customerType === "walkin") {
    throw new CustomerError("Walk-in customers have no daily subscription to pause");
  }
  validateDate(pauseFrom, "Pause from");
  validateDate(resumeDate, "Resume date");
  if (resumeDate <= pauseFrom) throw new CustomerError("Resume date must be after pause from");

  const ts = nowISO();
  await qrun(`UPDATE CustomerSubscription SET pauseFrom = ?, resumeDate = ?, status = 'paused', updatedAt = ? WHERE dairyId = ? AND customerId = ?`, pauseFrom, resumeDate, ts, dairyId, customerId);
  await qrun(`UPDATE Customer SET status = 'paused', updatedAt = ? WHERE dairyId = ? AND id = ?`, ts, dairyId, customerId);

  await qrun(`DELETE FROM DailyMilkDelivery
       WHERE dairyId = ? AND customerId = ? AND status = 'pending'
         AND date >= ? AND date < ?`, dairyId, customerId, pauseFrom, resumeDate);

  return await getCustomerRow(dairyId, customerId);
}

export async function resumeCustomer(dairyId: string, customerId: string) {
  await requireDairy(dairyId);
  const customer = await getCustomer(dairyId, customerId);
  if (customer.customerType === "walkin") {
    throw new CustomerError("Walk-in customers have no daily subscription to resume");
  }
  const ts = nowISO();
  await qrun(`UPDATE CustomerSubscription SET pauseFrom = NULL, resumeDate = NULL, status = 'active', updatedAt = ? WHERE dairyId = ? AND customerId = ?`, ts, dairyId, customerId);
  await qrun(`UPDATE Customer SET status = 'active', updatedAt = ? WHERE dairyId = ? AND id = ?`, ts, dairyId, customerId);
  await ensureDeliveriesForDate(dairyId, todayISO());
  return await getCustomerRow(dairyId, customerId);
}

export async function getCustomerRow(dairyId: string, customerId: string): Promise<CustomerRow> {
  const customer = await getCustomer(dairyId, customerId);
  const today = todayISO();
  const deliveryRow = asRecord(
    await qget(`SELECT * FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ?`, dairyId, customerId, today),
  );
  return {
    ...customer,
    subscription: await getSubscription(dairyId, customerId),
    todayDelivery: deliveryRow ? mapDelivery(deliveryRow) : null,
    outstanding: await getOutstanding(dairyId, customerId),
  };
}

async function dedupeCustomersByMobile(dairyId: string) {
  const rows = await qall(`SELECT id, mobile, customerType, createdAt FROM Customer WHERE dairyId = ?`, dairyId);
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const mobile = cleanMobile(storedMobile(row.mobile));
    if (!mobile) continue;
    const list = groups.get(mobile) ?? [];
    list.push(row);
    groups.set(mobile, list);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => {
      const ar = str(a.customerType) === "regular" ? 0 : 1;
      const br = str(b.customerType) === "regular" ? 0 : 1;
      if (ar !== br) return ar - br;
      return str(a.createdAt).localeCompare(str(b.createdAt));
    });
    const keep = str(list[0].id);
    for (const extra of list.slice(1)) {
      const id = str(extra.id);
      const clash = await qall(
        `SELECT e.date FROM DailyMilkDelivery e
         JOIN DailyMilkDelivery k ON k.dairyId = e.dairyId AND k.date = e.date AND k.customerId = ?
         WHERE e.dairyId = ? AND e.customerId = ?`,
        keep,
        dairyId,
        id,
      );
      for (const row of clash) {
        await qrun(
          `DELETE FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ?`,
          dairyId,
          id,
          str(row.date),
        );
      }
      await qrun(`UPDATE DailyMilkDelivery SET customerId = ? WHERE dairyId = ? AND customerId = ?`, keep, dairyId, id);
      await qrun(`UPDATE MilkLedger SET customerId = ? WHERE dairyId = ? AND customerId = ?`, keep, dairyId, id);
      await qrun(`UPDATE CustomerPayment SET customerId = ? WHERE dairyId = ? AND customerId = ?`, keep, dairyId, id);
      await qrun(`DELETE FROM MonthlyBill WHERE dairyId = ? AND customerId = ?`, dairyId, id);
      await qrun(`DELETE FROM CustomerSubscription WHERE dairyId = ? AND customerId = ?`, dairyId, id);
      await qrun(`DELETE FROM Customer WHERE dairyId = ? AND id = ?`, dairyId, id);
    }
  }
}

export async function listCustomers(dairyId: string): Promise<CustomerRow[]> {
  await requireDairy(dairyId);
  try {
    await dedupeCustomersByMobile(dairyId);
    await ensureDeliveriesForDate(dairyId, todayISO());
  } catch {
    // still return the customer master list
  }
  const rows = await qall(`SELECT * FROM Customer WHERE dairyId = ? ORDER BY customerCode ASC`, dairyId);
  return Promise.all(rows.map((row) => getCustomerRow(dairyId, str(row.id))));
}

export async function ensureDeliveriesForDate(dairyId: string, date: string) {
  await requireDairy(dairyId);
  validateDate(date, "Date");
  const subs = await qall(`SELECT s.*, c.status AS customerStatus, c.milkType AS customerMilkType
       FROM CustomerSubscription s
       JOIN Customer c ON c.id = s.customerId
       WHERE s.dairyId = ? AND s.startDate <= ? AND c.status != 'stopped' AND s.status != 'stopped'
         AND IFNULL(c.customerType, 'regular') = 'regular'`, dairyId, date);

  let created = 0;
  for (const raw of subs) {
    const sub = mapSubscription(raw);
    if (isPausedOn(sub, date)) {
      await qrun(`DELETE FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ? AND status = 'pending'`, dairyId, sub.customerId, date);
      continue;
    }

    const existing = asRecord(
      await qget(`SELECT id FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ?`, dairyId, sub.customerId, date),
    );
    if (existing) continue;

    const ts = nowISO();
    const milkType = MILK_TYPES.includes(str(raw.customerMilkType) as CustomerMilkType)
      ? str(raw.customerMilkType)
      : "cow";
    try {
      await qrun(`INSERT OR IGNORE INTO DailyMilkDelivery (id, dairyId, customerId, date, regularQty, extraQty, deliveredQty, rate, amount, status, skipReason, notes, milkType, source, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, 'pending', NULL, NULL, ?, 'subscription', ?, ?)`, randomUUID(), dairyId, sub.customerId, date, sub.dailyQty, sub.rate, milkType, ts, ts);
      created += 1;
    } catch {
      // another request already created today's row
    }
  }
  return created;
}

export async function listDeliveries(dairyId: string, date: string): Promise<DeliveryRow[]> {
  await requireDairy(dairyId);
  try {
    await ensureDeliveriesForDate(dairyId, date);
  } catch {
    // still return any rows already saved for this date
  }
  const rows = await qall(`SELECT d.* FROM DailyMilkDelivery d
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
       ORDER BY c.name ASC`, dairyId, date);

  return Promise.all(
    rows.map(async (row) => {
      const delivery = mapDelivery(row);
      return {
        ...delivery,
        customer: await getCustomer(dairyId, delivery.customerId),
        subscription: await getSubscription(dairyId, delivery.customerId),
      };
    }),
  );
}

async function getOwnedDelivery(dairyId: string, deliveryId: string) {
  const row = asRecord(
    await qget(`SELECT * FROM DailyMilkDelivery WHERE dairyId = ? AND id = ?`, dairyId, deliveryId),
  );
  if (!row) throw new CustomerError("Delivery not found", 404);
  return mapDelivery(row);
}

async function finalizeDelivery(
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
  const current = await getOwnedDelivery(dairyId, deliveryId);
  const ts = nowISO();
  await qrun(`UPDATE DailyMilkDelivery
       SET extraQty = ?, deliveredQty = ?, amount = ?, status = ?, skipReason = ?, notes = ?, updatedAt = ?
       WHERE dairyId = ? AND id = ?`, patch.extraQty,
      patch.deliveredQty,
      patch.amount,
      patch.status,
      patch.skipReason ?? null,
      patch.notes ?? null,
      ts,
      dairyId,
      deliveryId,);
  const next = await getOwnedDelivery(dairyId, deliveryId);
  await upsertLedger(next);
  await refreshMonthlyBill(dairyId, current.customerId, current.date);
  return {
    ...next,
    customer: await getCustomer(dairyId, next.customerId),
    subscription: await getSubscription(dairyId, next.customerId),
  } satisfies DeliveryRow;
}

export async function markDelivered(dairyId: string, deliveryId: string) {
  const current = await getOwnedDelivery(dairyId, deliveryId);
  const deliveredQty = round2(current.regularQty + current.extraQty);
  return await finalizeDelivery(dairyId, deliveryId, {
    status: current.extraQty > 0 ? "extra" : "delivered",
    deliveredQty,
    extraQty: current.extraQty,
    amount: round2(deliveredQty * current.rate),
    skipReason: null,
    notes: current.notes,
  });
}

export async function skipToday(dairyId: string, deliveryId: string, reason: string) {
  const note = cleanName(reason);
  if (note.length < 2) throw new CustomerError("Skip reason is required");
  await getOwnedDelivery(dairyId, deliveryId);
  return await finalizeDelivery(dairyId, deliveryId, {
    status: "skipped",
    deliveredQty: 0,
    extraQty: 0,
    amount: 0,
    skipReason: note,
    notes: note,
  });
}

export async function markNotDelivered(dairyId: string, deliveryId: string, reason?: string) {
  await getOwnedDelivery(dairyId, deliveryId);
  return await finalizeDelivery(dairyId, deliveryId, {
    status: "not_delivered",
    deliveredQty: 0,
    extraQty: 0,
    amount: 0,
    skipReason: reason ? cleanName(reason) : "Not delivered",
    notes: reason ? cleanName(reason) : "Not delivered",
  });
}

export async function markPartial(dairyId: string, deliveryId: string, qty: number, notes?: string) {
  const current = await getOwnedDelivery(dairyId, deliveryId);
  if (!Number.isFinite(qty) || qty <= 0) throw new CustomerError("Partial quantity must be greater than 0");
  if (qty >= current.regularQty) {
    throw new CustomerError("Partial quantity must be less than the regular daily quantity");
  }
  return await finalizeDelivery(dairyId, deliveryId, {
    status: "partial",
    deliveredQty: round2(qty),
    extraQty: 0,
    amount: round2(qty * current.rate),
    skipReason: null,
    notes: notes ? cleanName(notes) : "Partial delivery",
  });
}

export async function markExtra(dairyId: string, deliveryId: string, extraQty: number, notes?: string) {
  const current = await getOwnedDelivery(dairyId, deliveryId);
  if (!Number.isFinite(extraQty) || extraQty <= 0) throw new CustomerError("Extra milk must be greater than 0");
  const deliveredQty = round2(current.regularQty + extraQty);
  return await finalizeDelivery(dairyId, deliveryId, {
    status: "extra",
    deliveredQty,
    extraQty: round2(extraQty),
    amount: round2(deliveredQty * current.rate),
    skipReason: null,
    notes: notes ? cleanName(notes) : "Extra milk",
  });
}

export async function listLedger(
  dairyId: string,
  from: string,
  to: string,
  customerId?: string,
  filters?: { customerType?: CustomerType; milkType?: CustomerMilkType; paymentStatus?: SalePaymentStatus },
): Promise<LedgerRow[]> {
  await requireDairy(dairyId);
  validateDate(from, "From date");
  validateDate(to, "To date");
  if (to < from) throw new CustomerError("To date must be on or after from date");
  let sql = `SELECT l.*, IFNULL(d.milkType, c.milkType) AS rowMilkType, d.paymentStatus AS salePaymentStatus
       FROM MilkLedger l
       JOIN Customer c ON c.id = l.customerId
       LEFT JOIN DailyMilkDelivery d ON d.id = l.deliveryId
       WHERE l.dairyId = ? AND l.date >= ? AND l.date <= ?`;
  const params: unknown[] = [dairyId, from, to];
  if (customerId) {
    sql += ` AND l.customerId = ?`;
    params.push(customerId);
  }
  if (filters?.customerType) {
    sql += ` AND IFNULL(c.customerType, 'regular') = ?`;
    params.push(filters.customerType);
  }
  if (filters?.milkType) {
    sql += ` AND IFNULL(d.milkType, c.milkType) = ?`;
    params.push(filters.milkType);
  }
  if (filters?.paymentStatus) {
    sql += ` AND IFNULL(d.paymentStatus, '') = ?`;
    params.push(filters.paymentStatus);
  }
  sql += ` ORDER BY l.date DESC, l.createdAt DESC`;
  const rows = await qall(sql, ...params);
  const outstandingByCustomer = new Map<string, number>();
  return Promise.all(
    rows.map(async (row) => {
      const customerId = str(row.customerId);
      if (!outstandingByCustomer.has(customerId)) {
        outstandingByCustomer.set(customerId, await getOutstanding(dairyId, customerId));
      }
      const milkType = MILK_TYPES.includes(str(row.rowMilkType) as CustomerMilkType)
        ? (str(row.rowMilkType) as CustomerMilkType)
        : "cow";
      const paymentStatus = SALE_PAYMENT_STATUSES.includes(str(row.salePaymentStatus) as SalePaymentStatus)
        ? (str(row.salePaymentStatus) as SalePaymentStatus)
        : null;
      return {
        ...mapLedger(row),
        customer: await getCustomer(dairyId, customerId),
        milkType,
        paymentStatus,
        outstanding: outstandingByCustomer.get(customerId) ?? 0,
      };
    }),
  );
}

export async function listMonthlyBills(dairyId: string, year: number, month: number): Promise<BillRow[]> {
  await requireDairy(dairyId);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) {
    throw new CustomerError("Invalid month");
  }
  const customers = await qall(`SELECT id FROM Customer WHERE dairyId = ?`, dairyId);
  const date = `${year}-${String(month).padStart(2, "0")}-01`;
  for (const row of customers) {
    await refreshMonthlyBill(dairyId, str(row.id), date);
  }
  const bills = await qall(`SELECT * FROM MonthlyBill WHERE dairyId = ? AND year = ? AND month = ? ORDER BY customerId ASC`, dairyId, year, month);
  const mapped = await Promise.all(
    bills.map(async (row) => {
      const bill = mapBill(row);
      return { ...bill, customer: await getCustomer(dairyId, bill.customerId) };
    }),
  );
  return mapped.filter((bill) => bill.totalDelivered > 0 || bill.skippedDays > 0 || bill.paidAmount > 0);
}

export async function recordPayment(
  dairyId: string,
  input: { customerId: string; date: string; amount: number; mode: PaymentMode; reference?: string },
): Promise<PaymentRow> {
  await requireDairy(dairyId);
  const customer = await getCustomer(dairyId, input.customerId);
  validateDate(input.date, "Payment date");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new CustomerError("Payment amount must be greater than 0");
  }
  if (!PAYMENT_MODES.includes(input.mode)) throw new CustomerError("Choose a payment mode");
  const remaining = round2(await getOutstanding(dairyId, customer.id) - input.amount);
  const id = randomUUID();
  const ts = nowISO();
  const reference =
    cleanName(input.reference || "") ||
    `PAY-${input.date.replace(/-/g, "")}-${id.slice(0, 8).toUpperCase()}`;
  await qrun(`INSERT INTO CustomerPayment (id, dairyId, customerId, date, amount, mode, reference, remainingBalance, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, id,
      dairyId,
      customer.id,
      input.date,
      round2(input.amount),
      input.mode,
      reference,
      remaining,
      ts,);
  await refreshMonthlyBill(dairyId, customer.id, input.date);
  const row = asRecord(
    await qget(`SELECT * FROM CustomerPayment WHERE dairyId = ? AND id = ?`, dairyId, id),
  );
  if (!row) throw new CustomerError("Payment failed", 500);
  return { ...mapPayment(row), customer };
}

export async function listPayments(dairyId: string, customerId?: string): Promise<PaymentRow[]> {
  await requireDairy(dairyId);
  const rows = customerId
    ? await qall(`SELECT * FROM CustomerPayment WHERE dairyId = ? AND customerId = ? ORDER BY date DESC, createdAt DESC`, dairyId, customerId)
    : await qall(`SELECT * FROM CustomerPayment WHERE dairyId = ? ORDER BY date DESC, createdAt DESC`, dairyId);
  return Promise.all(
    rows.map(async (row) => ({
      ...mapPayment(row),
      customer: await getCustomer(dairyId, str(row.customerId)),
    })),
  );
}

export async function seedTestCustomer(dairyId: string) {
  await requireDairy(dairyId);
  const startDate = addDays(todayISO(), -7);
  const existing = await findCustomerByMobile(dairyId, "9876502001");
  if (existing) {
    try {
      await qrun(`UPDATE CustomerSubscription SET startDate = ? WHERE dairyId = ? AND customerId = ? AND startDate > ?`, startDate, dairyId, existing.id, startDate);
    } catch {
      // walk-in or missing subscription — keep the master record
    }
    return await getCustomerRow(dairyId, existing.id);
  }
  return await createCustomer(dairyId, {
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

async function rememberWalkInDefaults(
  dairyId: string,
  customerId: string,
  milkType: CustomerMilkType,
  qty: number,
  rate: number,
) {
  await qrun(`UPDATE Customer SET milkType = ?, defaultQty = ?, defaultRate = ?, updatedAt = ? WHERE dairyId = ? AND id = ?`, milkType, qty, rate, nowISO(), dairyId, customerId);
}

function walkInPaymentRef(deliveryId: string) {
  return `walkin:${deliveryId}`;
}

async function syncWalkInPayment(dairyId: string, customerId: string, date: string, deliveryId: string, paidAmount: number, mode: PaymentMode) {
  await qrun(`DELETE FROM CustomerPayment WHERE dairyId = ? AND reference = ?`, dairyId, walkInPaymentRef(deliveryId));
  if (paidAmount > 0) {
    await recordPayment(dairyId, {
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

export async function createWalkInSale(dairyId: string, raw: WalkInSaleInput): Promise<DeliveryRow> {
  await requireDairy(dairyId);
  const customer = await getCustomer(dairyId, raw.customerId);
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
    await qget(`SELECT * FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ?`, dairyId, customer.id, raw.date),
  );
  const ts = nowISO();
  const notes = raw.notes ? cleanName(raw.notes) : null;

  if (existing) {
    const current = mapDelivery(existing);
    if (current.source !== "walkin") {
      throw new CustomerError("This date already has a subscription delivery for the customer");
    }
    return await updateWalkInSale(dairyId, current.id, raw);
  }

  const id = randomUUID();
  try {
    await qrun(`INSERT INTO DailyMilkDelivery (id, dairyId, customerId, date, regularQty, extraQty, deliveredQty, rate, amount, status, skipReason, notes, milkType, source, paymentStatus, paymentMode, paidAmount, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'delivered', NULL, ?, ?, 'walkin', ?, ?, ?, ?, ?)`, id, dairyId, customer.id, raw.date, qty, qty, rate, amount, notes, raw.milkType, raw.paymentStatus, mode, paidAmount, ts, ts);
  } catch (error) {
    const existingNow = asRecord(
      await qget(`SELECT * FROM DailyMilkDelivery WHERE dairyId = ? AND customerId = ? AND date = ?`, dairyId, customer.id, raw.date),
    );
    if (existingNow) return await updateWalkInSale(dairyId, str(existingNow.id), raw);
    throw error;
  }

  await rememberWalkInDefaults(dairyId, customer.id, raw.milkType, qty, rate);
  const saved = await getOwnedDelivery(dairyId, id);
  await upsertLedger(saved);
  await refreshMonthlyBill(dairyId, customer.id, raw.date);
  await syncWalkInPayment(dairyId, customer.id, raw.date, id, paidAmount, mode);
  return {
    ...await getOwnedDelivery(dairyId, id),
    customer: await getCustomer(dairyId, customer.id),
    subscription: null,
  };
}

export async function updateWalkInSale(dairyId: string, deliveryId: string, raw: Partial<WalkInSaleInput> & Pick<WalkInSaleInput, "quantity" | "rate" | "paymentStatus">): Promise<DeliveryRow> {
  await requireDairy(dairyId);
  const current = await getOwnedDelivery(dairyId, deliveryId);
  if (current.source !== "walkin") throw new CustomerError("This is not a walk-in sale");
  const customer = await getCustomer(dairyId, current.customerId);
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

  await rememberWalkInDefaults(dairyId, customer.id, milkType, qty, rate);

  await qrun(`UPDATE DailyMilkDelivery
       SET regularQty = ?, deliveredQty = ?, rate = ?, amount = ?, notes = ?, milkType = ?, paymentStatus = ?, paymentMode = ?, paidAmount = ?, updatedAt = ?
       WHERE dairyId = ? AND id = ?`, qty, qty, rate, amount, notes, milkType, raw.paymentStatus, mode, paidAmount, ts, dairyId, deliveryId);

  const next = await getOwnedDelivery(dairyId, deliveryId);
  await upsertLedger(next);
  await refreshMonthlyBill(dairyId, customer.id, current.date);
  await syncWalkInPayment(dairyId, customer.id, current.date, deliveryId, paidAmount, mode);
  return {
    ...await getOwnedDelivery(dairyId, deliveryId),
    customer: await getCustomer(dairyId, customer.id),
    subscription: null,
  };
}

export async function deleteWalkInSale(dairyId: string, deliveryId: string) {
  await requireDairy(dairyId);
  const current = await getOwnedDelivery(dairyId, deliveryId);
  if (current.source !== "walkin") throw new CustomerError("Only walk-in sales can be deleted here");
  await qrun(`DELETE FROM MilkLedger WHERE dairyId = ? AND deliveryId = ?`, dairyId, deliveryId);
  await qrun(`DELETE FROM CustomerPayment WHERE dairyId = ? AND reference = ?`, dairyId, walkInPaymentRef(deliveryId));
  await qrun(`DELETE FROM DailyMilkDelivery WHERE dairyId = ? AND id = ?`, dairyId, deliveryId);
  await refreshMonthlyBill(dairyId, current.customerId, current.date);
  return { ok: true };
}

export async function listWalkInSales(dairyId: string, date: string): Promise<DeliveryRow[]> {
  await requireDairy(dairyId);
  validateDate(date, "Date");
  const rows = await qall(`SELECT d.* FROM DailyMilkDelivery d
       JOIN Customer c ON c.id = d.customerId
       WHERE d.dairyId = ? AND d.date = ? AND IFNULL(d.source, 'subscription') = 'walkin'
       ORDER BY d.createdAt DESC`, dairyId, date);
  return Promise.all(
    rows.map(async (row) => {
      const delivery = mapDelivery(row);
      return {
        ...delivery,
        customer: await getCustomer(dairyId, delivery.customerId),
        subscription: null,
      };
    }),
  );
}

export async function walkInTotals(dairyId: string, date: string): Promise<WalkInTotals> {
  const sales = await listWalkInSales(dairyId, date);
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

export async function searchCustomers(dairyId: string, query: string, type?: CustomerType): Promise<CustomerRow[]> {
  await requireDairy(dairyId);
  const q = query.trim();
  if (!q && !type) return [];
  let sql = `SELECT * FROM Customer WHERE dairyId = ?`;
  const params: unknown[] = [dairyId];
  if (type) {
    sql += ` AND IFNULL(customerType, 'regular') = ?`;
    params.push(type);
  }
  if (q) {
    sql += ` AND (lower(name) LIKE ? OR mobile LIKE ? OR lower(customerCode) LIKE ?)`;
    params.push(`%${q.toLowerCase()}%`, `%${q}%`, `%${q.toLowerCase()}%`);
  }
  sql += ` ORDER BY name ASC LIMIT 40`;
  const rows = await qall(sql, ...params);
  return Promise.all(rows.map((row) => getCustomerRow(dairyId, str(row.id))));
}

export async function customerDashboardStats(dairyId: string, date: string): Promise<CustomerDashboardStats> {
  await requireDairy(dairyId);
  validateDate(date, "Date");
  const counts = await qget(`SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN IFNULL(customerType, 'regular') = 'regular' THEN 1 ELSE 0 END), 0) AS regular,
         COALESCE(SUM(CASE WHEN customerType = 'walkin' THEN 1 ELSE 0 END), 0) AS walkin,
         COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active
       FROM Customer WHERE dairyId = ?`, dairyId);
  const sales = await qget(`SELECT
         COALESCE(SUM(CASE WHEN status IN ('delivered','partial','extra') THEN deliveredQty ELSE 0 END), 0) AS qty,
         COALESCE(SUM(CASE WHEN status IN ('delivered','partial','extra') THEN amount ELSE 0 END), 0) AS sales,
         COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'walkin' THEN deliveredQty ELSE 0 END), 0) AS walkInQty,
         COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'walkin' THEN amount ELSE 0 END), 0) AS walkInSales,
         COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'subscription' AND status IN ('delivered','partial','extra') THEN deliveredQty ELSE 0 END), 0) AS regularQty,
         COALESCE(SUM(CASE WHEN IFNULL(source, 'subscription') = 'subscription' AND status IN ('delivered','partial','extra') THEN amount ELSE 0 END), 0) AS regularSales
       FROM DailyMilkDelivery WHERE dairyId = ? AND date = ?`, dairyId, date);
  const pending = await qget(`SELECT COUNT(*) AS n, COALESCE(SUM(outstanding), 0) AS amount FROM (
         SELECT
           COALESCE((SELECT SUM(amount) FROM MilkLedger l WHERE l.dairyId = c.dairyId AND l.customerId = c.id), 0)
           - COALESCE((SELECT SUM(amount) FROM CustomerPayment p WHERE p.dairyId = c.dairyId AND p.customerId = c.id), 0)
           AS outstanding
         FROM Customer c
         WHERE c.dairyId = ?
       ) x WHERE outstanding > 0.005`, dairyId);

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

export async function countCustomers(dairyId: string) {
  return num(
    (await qget(`SELECT COUNT(*) AS t FROM Customer WHERE dairyId = ?`, dairyId))?.t,
  );
}

export { addDays };

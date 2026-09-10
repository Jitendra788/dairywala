import { addDays, todayISO } from "@/lib/dates";
import { CustomerError } from "@/lib/customers/errors";
import { numField, strField, withDairy } from "@/lib/customers/http";
import {
  createCustomer,
  createWalkInSale,
  customerDashboardStats,
  deleteWalkInSale,
  getCustomerRow,
  listCustomers,
  listDeliveries,
  listLedger,
  listMonthlyBills,
  listPayments,
  listWalkInSales,
  markDelivered,
  markExtra,
  markNotDelivered,
  markPartial,
  pauseCustomer,
  peekNextCustomerCode,
  recordPayment,
  resumeCustomer,
  searchCustomers,
  skipToday,
  updateCustomer,
  updateWalkInSale,
  walkInTotals,
} from "@/lib/customers/service";
import type {
  CreateCustomerInput,
  CustomerMilkType,
  CustomerStatus,
  CustomerType,
  PaymentCycle,
  PaymentMode,
  SalePaymentStatus,
  UpdateCustomerInput,
  WalkInSaleInput,
} from "@/lib/customers/types";
import { CUSTOMER_TYPES, MILK_TYPES, SALE_PAYMENT_STATUSES } from "@/lib/customers/types";

export const runtime = "nodejs";

export function handleListCustomers(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const typeParam = url.searchParams.get("type") || "";
  const type = CUSTOMER_TYPES.includes(typeParam as CustomerType) ? (typeParam as CustomerType) : undefined;
  return withDairy(request, async (dairyId) => ({
    nextCode: await peekNextCustomerCode(dairyId),
    customers: q || type ? await searchCustomers(dairyId, q, type) : await listCustomers(dairyId),
  }));
}

export function handleCreateCustomer(request: Request) {
  return withDairy(request, async (dairyId, body) => {
    const customerType = strField(body, "customerType") as CustomerType;
    const input: CreateCustomerInput = {
      name: strField(body, "name"),
      mobile: strField(body, "mobile"),
      address: strField(body, "address"),
      milkType: strField(body, "milkType") as CustomerMilkType,
      customerType: CUSTOMER_TYPES.includes(customerType) ? customerType : "regular",
      dailyQty: body.dailyQty == null || body.dailyQty === "" ? undefined : numField(body, "dailyQty"),
      rate: body.rate == null || body.rate === "" ? undefined : numField(body, "rate"),
      startDate: strField(body, "startDate") || undefined,
      deliveryTime: strField(body, "deliveryTime") || undefined,
      paymentCycle: (strField(body, "paymentCycle") || undefined) as PaymentCycle | undefined,
      status: (strField(body, "status") || undefined) as CustomerStatus | undefined,
    };
    return { customer: await createCustomer(dairyId, input) };
  });
}

export function handleGetCustomer(request: Request, id: string) {
  return withDairy(request, async (dairyId) => ({ customer: await getCustomerRow(dairyId, id) }));
}

export function handleUpdateCustomer(request: Request, id: string) {
  return withDairy(request, async (dairyId, body) => {
    const input: UpdateCustomerInput = {};
    if (body.name != null) input.name = strField(body, "name");
    if (body.mobile != null) input.mobile = strField(body, "mobile");
    if (body.address != null) input.address = strField(body, "address");
    if (body.milkType != null) input.milkType = strField(body, "milkType") as CustomerMilkType;
    if (body.dailyQty != null) input.dailyQty = numField(body, "dailyQty");
    if (body.rate != null) input.rate = numField(body, "rate");
    if (body.deliveryTime != null) input.deliveryTime = strField(body, "deliveryTime");
    if (body.paymentCycle != null) input.paymentCycle = strField(body, "paymentCycle") as PaymentCycle;
    if (body.status != null) input.status = strField(body, "status") as CustomerStatus;
    return { customer: await updateCustomer(dairyId, id, input) };
  });
}

export function handlePauseCustomer(request: Request, id: string) {
  return withDairy(request, async (dairyId, body) => ({
    customer: await pauseCustomer(dairyId, id, strField(body, "pauseFrom"), strField(body, "resumeDate")),
  }));
}

export function handleResumeCustomer(request: Request, id: string) {
  return withDairy(request, async (dairyId) => ({ customer: await resumeCustomer(dairyId, id) }));
}

export function handleListDeliveries(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || todayISO();
  return withDairy(request, async (dairyId) => ({ date, deliveries: await listDeliveries(dairyId, date) }));
}

export function handleDeliveryAction(request: Request, id: string) {
  return withDairy(request, async (dairyId, body) => {
    const action = strField(body, "action");
    if (action === "delivered") return { delivery: await markDelivered(dairyId, id) };
    if (action === "skip") return { delivery: await skipToday(dairyId, id, strField(body, "reason")) };
    if (action === "not_delivered") {
      return { delivery: await markNotDelivered(dairyId, id, strField(body, "reason")) };
    }
    if (action === "partial") {
      return { delivery: await markPartial(dairyId, id, numField(body, "qty"), strField(body, "notes")) };
    }
    if (action === "extra") {
      return { delivery: await markExtra(dairyId, id, numField(body, "extraQty"), strField(body, "notes")) };
    }
    throw new CustomerError("Unknown delivery action");
  });
}

function saleInput(body: Record<string, unknown>): WalkInSaleInput {
  return {
    customerId: strField(body, "customerId"),
    date: strField(body, "date") || todayISO(),
    milkType: strField(body, "milkType") as CustomerMilkType,
    quantity: numField(body, "quantity"),
    rate: numField(body, "rate"),
    paymentStatus: strField(body, "paymentStatus") as SalePaymentStatus,
    paymentMode: (strField(body, "paymentMode") || undefined) as PaymentMode | undefined,
    paidAmount: body.paidAmount == null || body.paidAmount === "" ? undefined : numField(body, "paidAmount"),
    notes: strField(body, "notes") || undefined,
  };
}

export function handleListSales(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || todayISO();
  return withDairy(request, async (dairyId) => ({
    date,
    sales: await listWalkInSales(dairyId, date),
    totals: await walkInTotals(dairyId, date),
  }));
}

export function handleCreateSale(request: Request) {
  return withDairy(request, async (dairyId, body) => ({ sale: await createWalkInSale(dairyId, saleInput(body)) }));
}

export function handleUpdateSale(request: Request, id: string) {
  return withDairy(request, async (dairyId, body) => ({
    sale: await updateWalkInSale(dairyId, id, {
      quantity: numField(body, "quantity"),
      rate: numField(body, "rate"),
      paymentStatus: strField(body, "paymentStatus") as SalePaymentStatus,
      milkType: (strField(body, "milkType") || undefined) as CustomerMilkType | undefined,
      paymentMode: (strField(body, "paymentMode") || undefined) as PaymentMode | undefined,
      paidAmount: body.paidAmount == null || body.paidAmount === "" ? undefined : numField(body, "paidAmount"),
      notes: body.notes == null ? undefined : strField(body, "notes"),
    }),
  }));
}

export function handleDeleteSale(request: Request, id: string) {
  return withDairy(request, async (dairyId) => deleteWalkInSale(dairyId, id));
}

export function handleListLedger(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || addDays(todayISO(), -30);
  const to = url.searchParams.get("to") || todayISO();
  const customerId = url.searchParams.get("customerId") || undefined;
  const typeParam = url.searchParams.get("customerType") || "";
  const milkParam = url.searchParams.get("milkType") || "";
  const payParam = url.searchParams.get("paymentStatus") || "";
  const filters = {
    customerType: CUSTOMER_TYPES.includes(typeParam as CustomerType) ? (typeParam as CustomerType) : undefined,
    milkType: MILK_TYPES.includes(milkParam as CustomerMilkType) ? (milkParam as CustomerMilkType) : undefined,
    paymentStatus: SALE_PAYMENT_STATUSES.includes(payParam as SalePaymentStatus)
      ? (payParam as SalePaymentStatus)
      : undefined,
  };
  return withDairy(request, async (dairyId) => ({
    from,
    to,
    rows: await listLedger(dairyId, from, to, customerId, filters),
  }));
}

export function handleListBills(request: Request) {
  const url = new URL(request.url);
  const today = todayISO();
  const year = Number(url.searchParams.get("year") || today.slice(0, 4));
  const month = Number(url.searchParams.get("month") || today.slice(5, 7));
  return withDairy(request, async (dairyId) => ({
    year,
    month,
    bills: await listMonthlyBills(dairyId, year, month),
  }));
}

export function handleListPayments(request: Request) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId") || undefined;
  return withDairy(request, async (dairyId) => ({ payments: await listPayments(dairyId, customerId) }));
}

export function handleCreatePayment(request: Request) {
  return withDairy(request, async (dairyId, body) => ({
    payment: await recordPayment(dairyId, {
      customerId: strField(body, "customerId"),
      date: strField(body, "date"),
      amount: numField(body, "amount"),
      mode: strField(body, "mode") as PaymentMode,
      reference: strField(body, "reference"),
    }),
  }));
}

export function handleCustomerStats(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || todayISO();
  return withDairy(request, async (dairyId) => customerDashboardStats(dairyId, date));
}

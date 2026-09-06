import { addDays, todayISO } from "@/lib/dates";
import { withDairy } from "@/lib/customers/http";
import { listLedger } from "@/lib/customers/service";
import type { CustomerMilkType, CustomerType, SalePaymentStatus } from "@/lib/customers/types";
import { CUSTOMER_TYPES, MILK_TYPES, SALE_PAYMENT_STATUSES } from "@/lib/customers/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
  return withDairy(request, (dairyId) => ({
    from,
    to,
    rows: listLedger(dairyId, from, to, customerId, filters),
  }));
}

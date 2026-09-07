import { withDairy, numField, strField } from "@/lib/customers/http";
import {
  createCustomer,
  listCustomers,
  peekNextCustomerCode,
  searchCustomers,
  seedTestCustomer,
} from "@/lib/customers/service";
import type {
  CreateCustomerInput,
  CustomerMilkType,
  CustomerStatus,
  CustomerType,
  PaymentCycle,
} from "@/lib/customers/types";
import { CUSTOMER_TYPES } from "@/lib/customers/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const typeParam = url.searchParams.get("type") || "";
  const type = CUSTOMER_TYPES.includes(typeParam as CustomerType) ? (typeParam as CustomerType) : undefined;
  return withDairy(request, (dairyId) => {
    try {
      seedTestCustomer(dairyId);
    } catch {
      // listing customers must still work if demo seed cannot run
    }
    return {
      nextCode: peekNextCustomerCode(dairyId),
      customers: q || type ? searchCustomers(dairyId, q, type) : listCustomers(dairyId),
    };
  });
}

export async function POST(request: Request) {
  return withDairy(request, (dairyId, body) => {
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
    return { customer: createCustomer(dairyId, input) };
  });
}

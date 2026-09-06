import { withDairy, numField, strField } from "@/lib/customers/http";
import {
  createCustomer,
  listCustomers,
  peekNextCustomerCode,
  seedTestCustomer,
} from "@/lib/customers/service";
import type { CreateCustomerInput, CustomerMilkType, CustomerStatus, PaymentCycle } from "@/lib/customers/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withDairy(request, (dairyId) => {
    seedTestCustomer(dairyId);
    return {
      nextCode: peekNextCustomerCode(dairyId),
      customers: listCustomers(dairyId),
    };
  });
}

export async function POST(request: Request) {
  return withDairy(request, (dairyId, body) => {
    const input: CreateCustomerInput = {
      name: strField(body, "name"),
      mobile: strField(body, "mobile"),
      address: strField(body, "address"),
      milkType: strField(body, "milkType") as CustomerMilkType,
      dailyQty: numField(body, "dailyQty"),
      rate: numField(body, "rate"),
      startDate: strField(body, "startDate"),
      deliveryTime: strField(body, "deliveryTime"),
      paymentCycle: strField(body, "paymentCycle") as PaymentCycle,
      status: strField(body, "status") as CustomerStatus,
    };
    return { customer: createCustomer(dairyId, input) };
  });
}

import { withDairy, numField, strField } from "@/lib/customers/http";
import { getCustomerRow, updateCustomer } from "@/lib/customers/service";
import type { CustomerMilkType, CustomerStatus, PaymentCycle, UpdateCustomerInput } from "@/lib/customers/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withDairy(request, (dairyId) => ({ customer: getCustomerRow(dairyId, id) }));
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withDairy(request, (dairyId, body) => {
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
    return { customer: updateCustomer(dairyId, id, input) };
  });
}

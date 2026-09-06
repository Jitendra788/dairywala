import { numField, strField, withDairy } from "@/lib/customers/http";
import { deleteWalkInSale, updateWalkInSale } from "@/lib/customers/service";
import type { CustomerMilkType, PaymentMode, SalePaymentStatus } from "@/lib/customers/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withDairy(request, (dairyId, body) => ({
    sale: updateWalkInSale(dairyId, id, {
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

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withDairy(request, (dairyId) => deleteWalkInSale(dairyId, id));
}

import { todayISO } from "@/lib/dates";
import { numField, strField, withDairy } from "@/lib/customers/http";
import { createWalkInSale, listWalkInSales, walkInTotals } from "@/lib/customers/service";
import type { CustomerMilkType, PaymentMode, SalePaymentStatus, WalkInSaleInput } from "@/lib/customers/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || todayISO();
  return withDairy(request, (dairyId) => ({
    date,
    sales: listWalkInSales(dairyId, date),
    totals: walkInTotals(dairyId, date),
  }));
}

export async function POST(request: Request) {
  return withDairy(request, (dairyId, body) => {
    const input: WalkInSaleInput = {
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
    return { sale: createWalkInSale(dairyId, input) };
  });
}

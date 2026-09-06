import { numField, strField, withDairy } from "@/lib/customers/http";
import { listPayments, recordPayment } from "@/lib/customers/service";
import type { PaymentMode } from "@/lib/customers/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId") || undefined;
  return withDairy(request, (dairyId) => ({ payments: listPayments(dairyId, customerId) }));
}

export async function POST(request: Request) {
  return withDairy(request, (dairyId, body) => ({
    payment: recordPayment(dairyId, {
      customerId: strField(body, "customerId"),
      date: strField(body, "date"),
      amount: numField(body, "amount"),
      mode: strField(body, "mode") as PaymentMode,
      reference: strField(body, "reference"),
    }),
  }));
}

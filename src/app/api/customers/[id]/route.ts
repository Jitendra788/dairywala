import { CustomerError, jsonError } from "@/lib/customers/errors";
import {
  handleCreatePayment,
  handleCreateSale,
  handleCustomerStats,
  handleGetCustomer,
  handleListBills,
  handleListDeliveries,
  handleListLedger,
  handleListPayments,
  handleListSales,
  handleUpdateCustomer,
} from "@/lib/customers/handlers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (id === "sales") return handleListSales(request);
  if (id === "deliveries") return handleListDeliveries(request);
  if (id === "ledger") return handleListLedger(request);
  if (id === "bills") return handleListBills(request);
  if (id === "payments") return handleListPayments(request);
  if (id === "stats") return handleCustomerStats(request);
  return handleGetCustomer(request, id);
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (id === "sales") return handleCreateSale(request);
  if (id === "payments") return handleCreatePayment(request);
  return jsonError(new CustomerError("Customer not found", 404));
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleUpdateCustomer(request, id);
}

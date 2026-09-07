import { handleGetCustomer, handleUpdateCustomer } from "@/lib/customers/handlers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleGetCustomer(request, id);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleUpdateCustomer(request, id);
}

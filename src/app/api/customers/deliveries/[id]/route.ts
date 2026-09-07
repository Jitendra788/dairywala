import { handleDeliveryAction } from "@/lib/customers/handlers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleDeliveryAction(request, id);
}

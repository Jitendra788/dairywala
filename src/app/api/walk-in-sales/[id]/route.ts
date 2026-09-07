import { handleDeleteSale, handleUpdateSale } from "@/lib/customers/handlers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleUpdateSale(request, id);
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleDeleteSale(request, id);
}

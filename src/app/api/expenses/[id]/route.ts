import { handleDeleteExpense, handleUpdateExpense } from "@/lib/finance/handlers";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleUpdateExpense(request, id);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleDeleteExpense(request, id);
}

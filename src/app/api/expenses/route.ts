import { handleCreateExpense, handleListExpenses } from "@/lib/finance/handlers";

export const runtime = "nodejs";

export const GET = handleListExpenses;
export const POST = handleCreateExpense;

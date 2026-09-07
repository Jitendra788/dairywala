import { handleCreateSale, handleListSales } from "@/lib/customers/handlers";

export const runtime = "nodejs";

export const GET = handleListSales;
export const POST = handleCreateSale;

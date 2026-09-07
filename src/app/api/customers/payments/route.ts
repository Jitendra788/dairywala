import { handleCreatePayment, handleListPayments } from "@/lib/customers/handlers";

export const runtime = "nodejs";

export const GET = handleListPayments;
export const POST = handleCreatePayment;

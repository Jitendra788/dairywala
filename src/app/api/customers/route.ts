import { handleCreateCustomer, handleListCustomers } from "@/lib/customers/handlers";

export const runtime = "nodejs";

export const GET = handleListCustomers;
export const POST = handleCreateCustomer;

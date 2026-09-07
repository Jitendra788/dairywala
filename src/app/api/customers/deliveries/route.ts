import { handleListDeliveries } from "@/lib/customers/handlers";

export const runtime = "nodejs";

export const GET = handleListDeliveries;

import { todayISO } from "@/lib/dates";
import { withDairy } from "@/lib/customers/http";
import { customerDashboardStats } from "@/lib/customers/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || todayISO();
  return withDairy(request, (dairyId) => customerDashboardStats(dairyId, date));
}

import { todayISO } from "@/lib/dates";
import { withDairy } from "@/lib/customers/http";
import { listMonthlyBills } from "@/lib/customers/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const today = todayISO();
  const year = Number(url.searchParams.get("year") || today.slice(0, 4));
  const month = Number(url.searchParams.get("month") || today.slice(5, 7));
  return withDairy(request, (dairyId) => ({
    year,
    month,
    bills: listMonthlyBills(dairyId, year, month),
  }));
}

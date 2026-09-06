import { addDays, todayISO } from "@/lib/dates";
import { withDairy } from "@/lib/customers/http";
import { listLedger } from "@/lib/customers/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || addDays(todayISO(), -30);
  const to = url.searchParams.get("to") || todayISO();
  const customerId = url.searchParams.get("customerId") || undefined;
  return withDairy(request, (dairyId) => ({
    from,
    to,
    rows: listLedger(dairyId, from, to, customerId),
  }));
}

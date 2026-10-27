import { strField, withDairy } from "@/lib/customers/http";
import { loadDesk, runDeskOp } from "@/lib/desk/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withDairy(request, (dairyId) => loadDesk(dairyId));
}

const RELOAD_OPS = new Set(["generateBills", "resetDemo", "saveCharts", "deleteFarmer", "updateSettings", "addFarmerPayment"]);

export async function POST(request: Request) {
  return withDairy(request, async (dairyId, body) => {
    const op = strField(body, "op");
    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : body;
    const result = await runDeskOp(dairyId, op, payload);
    if (RELOAD_OPS.has(op)) {
      return { state: await loadDesk(dairyId), result };
    }
    return { result };
  });
}

import { strField, withDairy } from "@/lib/customers/http";
import { loadDesk, runDeskOp } from "@/lib/desk/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withDairy(request, (dairyId) => loadDesk(dairyId));
}

export async function POST(request: Request) {
  return withDairy(request, async (dairyId, body) => {
    const op = strField(body, "op");
    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : body;
    const result = await runDeskOp(dairyId, op, payload);
    const state = await loadDesk(dairyId);
    return { state, result };
  });
}

import { getRequestDairyId } from "@/lib/customers/context";
import { jsonError } from "@/lib/customers/errors";
import { runCustomerFlowTest } from "@/lib/customers/verify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const dairyId = getRequestDairyId(request);
    return Response.json(runCustomerFlowTest(dairyId));
  } catch (error) {
    return jsonError(error);
  }
}

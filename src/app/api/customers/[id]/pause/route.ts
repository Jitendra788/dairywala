import { withDairy, strField } from "@/lib/customers/http";
import { pauseCustomer } from "@/lib/customers/service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withDairy(request, (dairyId, body) => ({
    customer: pauseCustomer(dairyId, id, strField(body, "pauseFrom"), strField(body, "resumeDate")),
  }));
}

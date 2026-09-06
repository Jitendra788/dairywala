import { withDairy } from "@/lib/customers/http";
import { resumeCustomer } from "@/lib/customers/service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withDairy(request, (dairyId) => ({ customer: resumeCustomer(dairyId, id) }));
}

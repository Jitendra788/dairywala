import { CustomerError } from "@/lib/customers/errors";
import { numField, strField, withDairy } from "@/lib/customers/http";
import {
  markDelivered,
  markExtra,
  markNotDelivered,
  markPartial,
  skipToday,
} from "@/lib/customers/service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withDairy(request, (dairyId, body) => {
    const action = strField(body, "action");
    if (action === "delivered") return { delivery: markDelivered(dairyId, id) };
    if (action === "skip") return { delivery: skipToday(dairyId, id, strField(body, "reason")) };
    if (action === "not_delivered") {
      return { delivery: markNotDelivered(dairyId, id, strField(body, "reason")) };
    }
    if (action === "partial") {
      return { delivery: markPartial(dairyId, id, numField(body, "qty"), strField(body, "notes")) };
    }
    if (action === "extra") {
      return { delivery: markExtra(dairyId, id, numField(body, "extraQty"), strField(body, "notes")) };
    }
    throw new CustomerError("Unknown delivery action");
  });
}

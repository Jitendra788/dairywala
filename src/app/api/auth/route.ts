import { strField, withDairy } from "@/lib/customers/http";
import { CustomerError } from "@/lib/customers/errors";
import { changeDeskPassword, changeDeskUsername, getPublicAuth, loginDesk } from "@/lib/desk/auth-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withDairy(request, (dairyId) => getPublicAuth(dairyId));
}

export async function POST(request: Request) {
  return withDairy(request, async (dairyId, body) => {
    const op = strField(body, "op");
    if (op === "login") {
      return loginDesk(dairyId, strField(body, "username"), strField(body, "password"));
    }
    if (op === "changePassword") {
      await changeDeskPassword(dairyId, strField(body, "current"), strField(body, "next"));
      return getPublicAuth(dairyId);
    }
    if (op === "changeUsername") {
      const next = await changeDeskUsername(dairyId, strField(body, "current"), strField(body, "username"));
      return { ...(await getPublicAuth(dairyId)), username: next.username };
    }
    throw new CustomerError("Unknown auth action");
  });
}

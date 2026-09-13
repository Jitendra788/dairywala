import { getRequestDairyId } from "@/lib/customers/context";
import { strField, withDairy } from "@/lib/customers/http";
import { CustomerError, jsonError } from "@/lib/customers/errors";
import { changeDeskPassword, changeDeskUsername, getPublicAuth } from "@/lib/desk/auth-service";
import { loginPlatform, requestPasswordReset, resendCode, resetPassword, signupDairy, verifyEmail } from "@/lib/platform/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withDairy(request, (dairyId) => getPublicAuth(dairyId));
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    let body: Record<string, unknown> = {};
    if (text) body = JSON.parse(text) as Record<string, unknown>;
    const op = strField(body, "op");
    if (op === "signup") {
      return Response.json(
        await signupDairy({
          name: strField(body, "name"),
          email: strField(body, "email"),
          password: strField(body, "password"),
          dairyName: strField(body, "dairyName"),
          category: strField(body, "category"),
        }),
      );
    }
    if (op === "verify") {
      return Response.json(await verifyEmail(strField(body, "email"), strField(body, "code")));
    }
    if (op === "resend") {
      return Response.json(await resendCode(strField(body, "email")));
    }
    if (op === "login") {
      return Response.json(await loginPlatform(strField(body, "username"), strField(body, "password")));
    }
    if (op === "forgot") {
      return Response.json(await requestPasswordReset(strField(body, "email")));
    }
    if (op === "reset") {
      return Response.json(
        await resetPassword(strField(body, "email"), strField(body, "code"), strField(body, "password")),
      );
    }
    const dairyId = getRequestDairyId(request);
    if (op === "changePassword") {
      await changeDeskPassword(dairyId, strField(body, "current"), strField(body, "next"));
      return Response.json(await getPublicAuth(dairyId));
    }
    if (op === "changeUsername") {
      const next = await changeDeskUsername(dairyId, strField(body, "current"), strField(body, "username"));
      return Response.json({ ...(await getPublicAuth(dairyId)), username: next.username });
    }
    throw new CustomerError("Unknown auth action");
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError(new CustomerError("Invalid JSON"));
    return jsonError(error);
  }
}

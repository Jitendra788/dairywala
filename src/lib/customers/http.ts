import { getRequestDairyId } from "@/lib/customers/context";
import { CustomerError, jsonError } from "@/lib/customers/errors";

export async function withDairy<T>(
  request: Request,
  handler: (dairyId: string, body: Record<string, unknown>) => Promise<T> | T,
) {
  try {
    const dairyId = getRequestDairyId(request);
    let body: Record<string, unknown> = {};
    if (request.method !== "GET" && request.method !== "HEAD") {
      const text = await request.text();
      if (text) {
        const parsed = JSON.parse(text) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new CustomerError("Invalid request body");
        }
        body = parsed as Record<string, unknown>;
      }
    }
    const data = await handler(dairyId, body);
    return Response.json(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(new CustomerError("Invalid JSON"));
    }
    return jsonError(error);
  }
}

export function strField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return value == null ? "" : String(value);
}

export function numField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === "number" ? value : Number(value);
}

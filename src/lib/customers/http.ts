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
    const message = error instanceof Error ? error.message : "";
    if (request.method === "GET" && /UNIQUE constraint|SQLITE_BUSY|database is locked/i.test(message)) {
      try {
        const dairyId = getRequestDairyId(request);
        const data = await handler(dairyId, {});
        return Response.json(data);
      } catch {
        return jsonError(new CustomerError("Please refresh and try again"));
      }
    }
    if (/UNIQUE constraint|already exists/i.test(message)) {
      return jsonError(new CustomerError("This record already exists"));
    }
    if (/SQLITE_BUSY|database is locked/i.test(message)) {
      return jsonError(new CustomerError("Database is busy, try again"));
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

import { CustomerError } from "@/lib/customers/errors";

export const DEFAULT_DAIRY_ID = "tony-dairy";
export const DEFAULT_DAIRY_NAME = "Tony Dairy";

const DAIRY_RE = /^[a-zA-Z0-9_-]{3,64}$/;

function cookieValue(header: string | null, name: string) {
  if (!header) return "";
  const parts = header.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function getRequestDairyId(request: Request) {
  const header = request.headers.get("x-dairy-id")?.trim() || "";
  const cookie = cookieValue(request.headers.get("cookie"), "td_dairy").trim();
  const dairyId = header || cookie || DEFAULT_DAIRY_ID;
  if (!DAIRY_RE.test(dairyId)) {
    throw new CustomerError("Invalid dairy context", 403);
  }
  return dairyId;
}

export class CustomerError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CustomerError";
    this.status = status;
  }
}

export function isDbConnectError(error: unknown) {
  const parts: string[] = [];
  let cur: unknown = error;
  for (let i = 0; i < 5 && cur; i += 1) {
    if (cur instanceof Error) {
      parts.push(cur.name, cur.message);
      cur = cur.cause;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  return /ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|ECONNREFUSED|fetch failed|Error connecting to database|getaddrinfo|socket hang up|Connect Timeout/i.test(
    parts.join(" "),
  );
}

export function jsonError(error: unknown) {
  if (error instanceof CustomerError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  if (isDbConnectError(error)) {
    return Response.json({ error: "Database is temporarily unavailable. Try again." }, { status: 503 });
  }
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}

export class CustomerError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CustomerError";
    this.status = status;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof CustomerError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}

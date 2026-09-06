export class ApiError extends Error {}

export async function customerApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-dairy-id": "tony-dairy",
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(data.error || "Request failed");
  return data;
}

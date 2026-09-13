export class ApiError extends Error {}

function readClientSession(): { dairyId?: string; role?: string; impersonating?: boolean } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("tony-dairy-session") || "";
    if (raw) return JSON.parse(raw) as { dairyId?: string; role?: string };
  } catch {
    // ignore
  }
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== "td_session") continue;
    try {
      return JSON.parse(decodeURIComponent(rest.join("="))) as { dairyId?: string; role?: string };
    } catch {
      return null;
    }
  }
  return null;
}

function clientDairyId() {
  const session = readClientSession();
  if (session?.role === "platform_admin") return session.dairyId || "";
  if (session?.dairyId) return session.dairyId;
  if (typeof document !== "undefined") {
    const parts = document.cookie.split(";");
    for (const part of parts) {
      const [key, ...rest] = part.trim().split("=");
      if (key === "td_dairy") return decodeURIComponent(rest.join("="));
    }
  }
  return "tony-dairy";
}

function clientRole() {
  return readClientSession()?.role || "";
}

export async function customerApi<T>(url: string, init?: RequestInit): Promise<T> {
  const session = readClientSession();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-dairy-id": clientDairyId(),
      "x-auth-role": clientRole(),
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(data.error || "Request failed");
  const method = (init?.method || "GET").toUpperCase();
  if (session && "impersonating" in session && (session as { impersonating?: boolean }).impersonating && method !== "GET" && !url.startsWith("/api/platform")) {
    void fetch("/api/platform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "audit",
        module: url.replace("/api/", ""),
        action: method.toLowerCase(),
        dairyId: session.dairyId || "",
        newValue: url,
      }),
    }).catch(() => undefined);
  }
  return data;
}

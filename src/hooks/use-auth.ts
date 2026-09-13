import { useEffect, useSyncExternalStore } from "react";
import {
  ensureDefaultAuth,
  getAuthServerSnapshot,
  getSessionSnapshot,
  subscribeAuth,
} from "@/lib/auth";

export function useAuth() {
  const session = useSyncExternalStore(subscribeAuth, getSessionSnapshot, getAuthServerSnapshot);

  useEffect(() => {
    if (session?.role === "platform_admin") return;
    void ensureDefaultAuth();
  }, [session?.role]);

  return {
    session,
    username: session?.username ?? "",
    email: session?.email ?? "",
    name: session?.name ?? "",
    dairyId: session?.dairyId ?? "",
    role: session?.role,
    isAdmin: session?.role === "platform_admin" && !session?.impersonating,
    impersonating: Boolean(session?.impersonating),
    dairyName: session?.dairyName ?? "",
    loggedIn: Boolean(session),
  };
}

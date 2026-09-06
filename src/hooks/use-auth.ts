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
    void ensureDefaultAuth();
  }, []);

  return {
    session,
    username: session?.username ?? "",
    loggedIn: Boolean(session),
  };
}

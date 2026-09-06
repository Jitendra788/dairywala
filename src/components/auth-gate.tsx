"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Droplets } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { loggedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isLogin = pathname === "/login";

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!loggedIn && !isLogin) router.replace("/login");
    if (loggedIn && isLogin) router.replace("/");
  }, [ready, loggedIn, isLogin, router]);

  if (!ready || (!loggedIn && !isLogin)) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-4">
        <div className="flex items-center gap-2 text-primary">
          <Droplets size={20} />
          <span className="font-display text-xl">Tony Dairy</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useDairy } from "@/hooks/use-dairy";
import { hydrateDairy } from "@/lib/store";
import { isProfileReady } from "@/lib/profile";

export function AuthGate({ children }: { children: ReactNode }) {
  const { loggedIn } = useAuth();
  const dairy = useDairy();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const isLogin = pathname === "/login";
  const isSetup = pathname === "/setup";
  const needsProfile = loggedIn && !isProfileReady(dairy.settings);

  useEffect(() => {
    hydrateDairy();
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!loggedIn && !isLogin) {
      router.replace("/login");
      return;
    }
    if (loggedIn && isLogin) {
      router.replace(needsProfile ? "/setup" : "/");
      return;
    }
    if (loggedIn && needsProfile && !isSetup) {
      router.replace("/setup");
      return;
    }
    if (loggedIn && !needsProfile && isSetup) {
      router.replace("/");
    }
  }, [ready, loggedIn, isLogin, isSetup, needsProfile, router]);

  if (!ready || (!loggedIn && !isLogin) || (loggedIn && needsProfile && !isSetup && !isLogin)) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-4">
        <div className="flex items-center gap-2 text-primary">
          <img src="/dairy-logo.png" alt="" className="h-8 w-8 rounded-xl object-contain" />
          <span className="font-display text-xl">{dairy.settings.dairyName || "Tony Dairy"}</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

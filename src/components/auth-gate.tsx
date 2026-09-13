"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useDairy } from "@/hooks/use-dairy";
import { hydrateDairy } from "@/lib/store";
import { isProfileReady } from "@/lib/profile";
import { useI18n } from "@/hooks/use-i18n";

const PUBLIC_AUTH = new Set(["/login", "/signup", "/verify", "/forgot"]);

export function AuthGate({ children }: { children: ReactNode }) {
  const { loggedIn, dairyId, isAdmin } = useAuth();
  const { t } = useI18n();
  const dairy = useDairy();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const publicAuth = PUBLIC_AUTH.has(pathname);
  const isSetup = pathname === "/setup";
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const needsProfile = loggedIn && !isAdmin && !isProfileReady(dairy.settings);

  useEffect(() => {
    if (!loggedIn || isAdmin) {
      setReady(true);
      return;
    }
    setReady(false);
    void hydrateDairy()
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [loggedIn, dairyId, isAdmin]);

  useEffect(() => {
    if (loggedIn && !ready) return;
    if (!loggedIn && !publicAuth) {
      router.replace("/login");
      return;
    }
    if (loggedIn && isAdmin && !isAdminPage && pathname !== "/login") {
      router.replace("/admin");
      return;
    }
    if (loggedIn && publicAuth && pathname !== "/login") {
      router.replace(isAdmin ? "/admin" : needsProfile ? "/setup" : "/");
      return;
    }
    if (loggedIn && isAdminPage && !isAdmin) {
      router.replace("/");
      return;
    }
    if (loggedIn && needsProfile && !isSetup && pathname !== "/login") {
      router.replace("/setup");
      return;
    }
    if (loggedIn && !needsProfile && isSetup) {
      router.replace("/");
    }
  }, [ready, loggedIn, publicAuth, pathname, isSetup, isAdminPage, isAdmin, needsProfile, router]);

  if (publicAuth && !loggedIn) return <>{children}</>;
  if (isAdmin && isAdminPage) return <>{children}</>;
  if (loggedIn && isAdminPage && !isAdmin) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-4">
        <p className="text-sm text-muted">{t("openingDesk")}</p>
      </div>
    );
  }

  if (!ready || (!loggedIn && !publicAuth) || (loggedIn && needsProfile && !isSetup && !publicAuth)) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-4">
        <div className="flex items-center gap-2 text-primary">
          <img src="/dairy-logo.png" alt="" className="h-8 w-8 rounded-xl object-contain" />
          <span className="font-display text-xl">{dairy.settings.dairyName || "DudhSetu"}</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

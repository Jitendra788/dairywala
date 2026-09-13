import type { ReactNode } from "react";
import { Suspense } from "react";
import { SuperAdminShell } from "@/components/super-admin-shell";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <SuperAdminShell>{children}</SuperAdminShell>
    </Suspense>
  );
}

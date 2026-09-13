import { Suspense } from "react";
import { VerifyScreen } from "@/components/verify-screen";

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyScreen />
    </Suspense>
  );
}

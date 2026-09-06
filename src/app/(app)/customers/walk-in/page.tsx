import { Suspense } from "react";
import { WalkInView } from "@/components/customers/walk-in-view";

export default function WalkInCustomersPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading walk-in desk…</p>}>
      <WalkInView />
    </Suspense>
  );
}

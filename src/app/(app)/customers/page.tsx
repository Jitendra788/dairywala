import { Suspense } from "react";
import { AllCustomersView } from "@/components/customers/all-customers-view";

export default function CustomersPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading customers…</p>}>
      <AllCustomersView />
    </Suspense>
  );
}

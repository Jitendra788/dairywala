import { Suspense } from "react";
import { PaymentsView } from "@/components/views/payments-view";

export default function PaymentsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading payments…</p>}>
      <PaymentsView />
    </Suspense>
  );
}

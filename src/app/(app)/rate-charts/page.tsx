import { Suspense } from "react";
import { RateChartsView } from "@/components/views/rate-charts-view";

export default function RateChartsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading rate chart…</p>}>
      <RateChartsView />
    </Suspense>
  );
}

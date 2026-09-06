"use client";

import type { CustomerStatus, CustomerType, DeliveryStatus, SalePaymentStatus } from "@/lib/customers/types";

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const map = {
    active: "bg-emerald-50 text-primary",
    paused: "bg-amber-50 text-amber-800",
    stopped: "bg-stone-100 text-stone-600",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

export function CustomerTypeBadge({ type }: { type: CustomerType }) {
  if (type === "walkin") {
    return (
      <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
        Daily / Walk-in
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-primary">
      Regular
    </span>
  );
}

export function SalePaymentBadge({ status }: { status: SalePaymentStatus | null }) {
  if (!status) {
    return <span className="text-[12px] text-muted">Monthly</span>;
  }
  const map: Record<SalePaymentStatus, string> = {
    paid: "bg-emerald-50 text-primary",
    pending: "bg-amber-50 text-amber-800",
    partial: "bg-indigo-50 text-indigo-700",
  };
  const labels: Record<SalePaymentStatus, string> = {
    paid: "Paid",
    pending: "Pending",
    partial: "Partial",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus | null }) {
  if (!status) {
    return <span className="text-[12px] text-muted">—</span>;
  }
  const map: Record<DeliveryStatus, string> = {
    pending: "bg-sky-50 text-sky-700",
    delivered: "bg-emerald-50 text-primary",
    skipped: "bg-amber-50 text-amber-800",
    partial: "bg-indigo-50 text-indigo-700",
    extra: "bg-violet-50 text-violet-700",
    not_delivered: "bg-red-50 text-danger",
  };
  const labels: Record<DeliveryStatus, string> = {
    pending: "Pending",
    delivered: "Delivered",
    skipped: "Skipped",
    partial: "Partial",
    extra: "Extra milk",
    not_delivered: "Not delivered",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-display text-lg">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  );
}

export function LoadingRows({ cols }: { cols: number }) {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-t border-line/70">
          <td colSpan={cols} className="px-4 py-3">
            <div className="h-4 animate-pulse rounded-full bg-[#efe6d4]" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

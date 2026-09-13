"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { customerApi } from "@/lib/customers/client";
import { btnGhost } from "@/components/ui";
import type { PlatformStatus } from "@/lib/platform/types";

export function usePlatform<T>(view: string, extra = "") {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      setData(await customerApi<T>(`/api/platform?view=${view}${extra}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load fail");
    } finally {
      setLoading(false);
    }
  }, [view, extra]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}

export async function platformAct(body: Record<string, unknown>) {
  return customerApi("/api/platform", { method: "POST", body: JSON.stringify(body) });
}

export function AdminStatus({ status }: { status: string }) {
  const key = status === "blocked" ? "suspended" : status === "progress" ? "in progress" : status;
  const tone =
    status === "active" || status === "resolved" || status === "ok" || status === "paid" || status === "trial"
      ? "bg-emerald-50 text-primary"
      : status === "pending" || status === "expiring" || status === "progress" || status === "warn"
        ? "bg-amber-50 text-amber-800"
        : status === "blocked" || status === "cancelled" || status === "expired" || status === "closed" || status === "down"
          ? "bg-red-50 text-danger"
          : "bg-[#f4ead6] text-foreground";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${tone}`}>{key}</span>;
}

export function statusOf(status: PlatformStatus) {
  return status;
}

export function KpiCard({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-line bg-card p-3.5 shadow-[0_8px_24px_rgba(22,48,36,0.05)] hover:border-primary/30">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 font-display text-[22px] leading-none break-words">{value}</p>
    </Link>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-sm text-muted">{text}</p>;
}

export function LoadingState() {
  return <p className="px-4 py-10 text-center text-sm text-muted">Loading…</p>;
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/40">
      <button type="button" className="h-full flex-1" aria-label="Close" onClick={onClose} />
      <aside className="flex h-full w-full max-w-none flex-col overflow-y-auto border-l border-line bg-card p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[-12px_0_40px_rgba(18,40,30,0.12)] sm:max-w-md">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl">{title}</h2>
          <button type="button" className={btnGhost} onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-40 items-end gap-1 px-3 pb-2 pt-4">
      {data.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex h-28 w-full items-end">
            <div className="w-full rounded-t bg-primary/80" style={{ height: `${(item.value / max) * 100}%` }} title={String(item.value)} />
          </div>
          <span className="truncate text-[9px] text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 320;
  const h = 120;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((item, i) => `${i * step},${h - (item.value / max) * (h - 8)}`).join(" ");
  return (
    <div className="px-3 py-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full">
        <polyline fill="none" stroke="#187a48" strokeWidth="2.5" points={points} />
      </svg>
      <div className="flex justify-between text-[9px] text-muted">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const colors = ["#187a48", "#c49a45", "#b42318", "#667066"];
  let acc = 0;
  const segs = data.map((item, i) => {
    const start = acc / total;
    acc += item.value;
    const end = acc / total;
    return { ...item, start, end, color: colors[i % colors.length] };
  });
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <svg viewBox="0 0 36 36" className="h-24 w-24 shrink-0">
        {segs.map((seg) => {
          const a = 2 * Math.PI * seg.start - Math.PI / 2;
          const b = 2 * Math.PI * seg.end - Math.PI / 2;
          const large = seg.end - seg.start > 0.5 ? 1 : 0;
          const d = `M 18 18 L ${18 + 16 * Math.cos(a)} ${18 + 16 * Math.sin(a)} A 16 16 0 ${large} 1 ${18 + 16 * Math.cos(b)} ${18 + 16 * Math.sin(b)} Z`;
          return <path key={seg.label} d={d} fill={seg.color} />;
        })}
        <circle cx="18" cy="18" r="8" fill="#fffdf8" />
      </svg>
      <ul className="space-y-1 text-[12px]">
        {data.map((item, i) => (
          <li key={item.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />
            {item.label} · {item.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function pager<T>(rows: T[], page: number, size = 10) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const safe = Math.min(page, pages);
  return { rows: rows.slice((safe - 1) * size, safe * size), pages, page: safe };
}

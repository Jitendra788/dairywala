import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  hint,
  actions,
}: {
  kicker?: string;
  title: string;
  hint?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker ? (
          <p className="text-[10px] font-semibold tracking-[0.18em] text-primary uppercase">
            {kicker}
          </p>
        ) : null}
        <h1 className="font-display text-[24px] leading-tight tracking-tight break-words sm:text-[28px] sm:leading-none">
          {title}
        </h1>
        {hint ? <p className="mt-1.5 max-w-xl text-[13px] text-muted">{hint}</p> : null}
      </div>
      {actions ? <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap [&>*]:w-full sm:[&>*]:w-auto">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-card shadow-[0_8px_30px_rgba(22,48,36,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function MilkBadge({ type }: { type: "cow" | "buffalo" | "mixed" }) {
  const map = {
    cow: "bg-sky-50 text-sky-700",
    buffalo: "bg-amber-50 text-amber-800",
    mixed: "bg-stone-100 text-stone-600",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${map[type]}`}>
      {type}
    </span>
  );
}

export function Initials({ name }: { name: string }) {
  const letters = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-primary">
      {letters || "F"}
    </span>
  );
}

export function TableScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`table-scroll min-w-0 ${className}`}>{children}</div>;
}

export const inputClass =
  "w-full min-w-0 rounded-xl border border-line bg-[#fbf7ef] px-3 py-2.5 text-base outline-none transition-shadow focus:border-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,122,72,0.12)] md:py-2 md:text-sm";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-[0_6px_16px_rgba(24,122,72,0.28)] hover:bg-primary-dark disabled:opacity-50 sm:py-2";

export const btnInverse =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-primary shadow-none hover:bg-emerald-50 disabled:opacity-50 sm:py-2";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium whitespace-nowrap hover:bg-[#f7f1e6] sm:py-2";

export const btnDanger =
  "inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-100";

export function confirmAction(message: string) {
  return window.confirm(message);
}

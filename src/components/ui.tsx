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
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {kicker}
          </p>
        ) : null}
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">{title}</h1>
        {hint ? <p className="mt-1 max-w-xl text-sm text-muted">{hint}</p> : null}
      </div>
      {actions}
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
    <div className={`rounded-2xl border border-line bg-card shadow-sm ${className}`}>{children}</div>
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
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium hover:bg-background";

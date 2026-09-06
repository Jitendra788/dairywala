import type { ReactNode } from "react";

export function PageCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-sm">
      <h1 className="mb-4 text-lg font-semibold text-slate-800">{title}</h1>
      {children}
    </div>
  );
}

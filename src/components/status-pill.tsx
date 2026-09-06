import type { ModuleStatus } from "@/lib/modules";

const styles: Record<ModuleStatus, string> = {
  ready: "bg-emerald-100 text-emerald-800",
  building: "bg-amber-100 text-amber-900",
  planned: "bg-stone-100 text-stone-600",
};

const labels: Record<ModuleStatus, string> = {
  ready: "Ready",
  building: "Building",
  planned: "Planned",
};

export function StatusPill({ status }: { status: ModuleStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

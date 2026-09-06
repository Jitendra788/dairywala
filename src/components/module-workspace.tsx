import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ModuleIcon } from "@/lib/icons";
import { StatusPill } from "@/components/status-pill";
import type { DairyModule } from "@/lib/modules";

export function ModuleWorkspace({
  module,
  compact = false,
}: {
  module: DairyModule;
  compact?: boolean;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className={`flex flex-wrap items-start justify-between gap-4 ${compact ? "hidden" : ""}`}>
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
            <ModuleIcon slug={module.slug} className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
              Phase {module.phase} · {module.nameHi}
            </p>
            <h1 className="font-display text-3xl text-foreground">{module.name}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              {module.summary}
            </p>
          </div>
        </div>
        <StatusPill status={module.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard label="Hamari reference" value={module.hamariRef} />
        <InfoCard label="Roles" value={module.roles.join(" · ")} />
        <InfoCard
          label="Build status"
          value={
            module.status === "building"
              ? "Shell is live — next: working screens"
              : "Mapped. Implement after Phase 1 collection loop."
          }
        />
      </div>

      <section className="rounded-2xl border border-line bg-card p-6">
        <h2 className="font-display text-xl">Work flow</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {module.workflow.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm leading-6 text-foreground/85">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="font-display text-xl">Screens</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {module.screens.map((screen) => (
            <Link
              key={screen.path}
              href={toDemoHref(screen.path)}
              className="group rounded-2xl border border-line bg-card p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{screen.name}</p>
                <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-1 text-sm text-muted">{screen.purpose}</p>
              <p className="mt-2 font-mono text-[11px] text-primary">{screen.path}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl">Tables</h2>
        <div className="mt-4 space-y-3">
          {module.tables.map((table) => (
            <div key={table.name} className="rounded-2xl border border-line bg-card p-4">
              <p className="font-mono text-sm font-semibold text-primary">{table.name}</p>
              <p className="mt-2 flex flex-wrap gap-1.5">
                {table.fields.map((field) => (
                  <span
                    key={field}
                    className="rounded-md bg-background px-2 py-0.5 font-mono text-[11px] text-muted"
                  >
                    {field}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function toDemoHref(path: string) {
  return path.replaceAll("[id]", "demo");
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6">{value}</p>
    </div>
  );
}

import Link from "next/link";
import { ModuleIcon } from "@/lib/icons";
import { StatusPill } from "@/components/status-pill";
import { modules, phases } from "@/lib/modules";

export default function PlanPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Module-wise clone
        </p>
        <h1 className="font-display text-4xl tracking-tight">Tony Dairy plan</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
          Hamari Dairy ke public workflow ko Tony Dairy ke Next.js modules mein map
          kiya gaya hai. Har module ke screens, tables aur work flow uske page par
          hain. Pehla working loop: collection → rate → slip → bill → payout.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {phases.map((phase) => (
          <div key={phase.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-[11px] font-semibold text-gold">Phase {phase.id}</p>
            <p className="mt-1 text-sm font-semibold">{phase.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{phase.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-background text-[11px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Module</th>
              <th className="px-4 py-3 font-medium">Phase</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Hamari ref</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((mod) => (
              <tr key={mod.slug} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link href={`/${mod.slug}`} className="flex items-center gap-2 font-medium hover:text-primary">
                    <ModuleIcon slug={mod.slug} className="h-4 w-4 text-primary" />
                    <span>
                      {mod.name}
                      <span className="ml-2 hidden text-xs font-normal text-muted sm:inline">
                        {mod.nameHi}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{mod.phase}</td>
                <td className="hidden px-4 py-3 text-muted md:table-cell">{mod.hamariRef}</td>
                <td className="px-4 py-3">
                  <StatusPill status={mod.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border border-line bg-card p-6">
        <h2 className="font-display text-2xl">Foundation (har module se pehle)</h2>
        <ul className="mt-4 grid gap-2 text-sm leading-7 text-foreground/85 md:grid-cols-2">
          <li>Multi-tenant `dairies` + isolated data per dairy</li>
          <li>Users, roles, centre-level permissions</li>
          <li>Offline queue (`sync_queue`) for collection desks</li>
          <li>Device maps: analyzer, scale, 58mm printer</li>
          <li>10+ language strings on slips and farmer screens</li>
          <li>Same record on web, later Windows + Android apps</li>
        </ul>
      </section>
    </div>
  );
}

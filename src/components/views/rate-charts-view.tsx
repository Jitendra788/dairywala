"use client";

import { useEffect, useState } from "react";
import { lookupRate } from "@/lib/rate";
import { formatInr } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnPrimary, Card, Field, inputClass, PageHeader } from "@/components/ui";
import type { RateChart } from "@/lib/types";

export function RateChartsView() {
  const dairy = useDairy();
  const [charts, setCharts] = useState<RateChart[]>(dairy.charts);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCharts(dairy.charts);
  }, [dairy.charts]);

  function patch(id: string, next: Partial<RateChart>) {
    setCharts((all) => all.map((c) => (c.id === id ? { ...c, ...next } : c)));
    setSaved(false);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="रेट चार्ट"
        title="Rate charts"
        hint="Collection FAT/SNF se rate nikalta hai. Cow aur buffalo alag charts."
        actions={
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              dairy.saveCharts(charts);
              setSaved(true);
            }}
          >
            {saved ? "Saved" : "Save charts"}
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {charts.map((chart) => (
          <Card key={chart.id} className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">{chart.name}</h2>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chart.active}
                  onChange={(e) => patch(chart.id, { active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Field label="FAT ×">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={chart.fatCoeff}
                  onChange={(e) => patch(chart.id, { fatCoeff: Number(e.target.value) })}
                />
              </Field>
              <Field label="SNF ×">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={chart.snfCoeff}
                  onChange={(e) => patch(chart.id, { snfCoeff: Number(e.target.value) })}
                />
              </Field>
              <Field label="Base">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={chart.base}
                  onChange={(e) => patch(chart.id, { base: Number(e.target.value) })}
                />
              </Field>
            </div>
            <p className="mt-3 text-sm text-muted">
              Rate = FAT × {chart.fatCoeff} + SNF × {chart.snfCoeff} + {chart.base}
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="pb-1">FAT \\ SNF</th>
                    {[8.4, 8.6, 8.8, 9.0].map((snf) => (
                      <th key={snf} className="pb-1">
                        {snf}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[3.5, 4.5, 6.0, 6.8].map((fat) => (
                    <tr key={fat} className="border-t border-line">
                      <td className="py-1.5 font-medium">{fat}</td>
                      {[8.4, 8.6, 8.8, 9.0].map((snf) => (
                        <td key={snf}>{formatInr(lookupRate(chart, fat, snf))}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

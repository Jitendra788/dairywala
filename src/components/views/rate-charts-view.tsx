"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { lookupRate } from "@/lib/rate";
import { formatInr } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Card, Field, confirmAction, inputClass, PageHeader } from "@/components/ui";
import type { MilkType, RateChart } from "@/lib/types";

export function RateChartsView() {
  const dairy = useDairy();
  const [charts, setCharts] = useState<RateChart[]>(dairy.charts);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("New chart");
  const [milkType, setMilkType] = useState<MilkType | "all">("cow");

  useEffect(() => {
    setCharts(dairy.charts);
  }, [dairy.charts]);

  function patch(id: string, next: Partial<RateChart>) {
    setCharts((all) => all.map((c) => (c.id === id ? { ...c, ...next } : c)));
    setSaved(false);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        kicker="रेट चार्ट"
        title="Rate charts"
        hint="Add, update, delete. Collection isi formula se rate nikalta hai."
        actions={
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              dairy.saveCharts(charts);
              setSaved(true);
              setError("");
            }}
          >
            {saved ? "Saved" : "Save changes"}
          </button>
        }
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="New chart name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Milk">
          <select className={inputClass} value={milkType} onChange={(e) => setMilkType(e.target.value as MilkType | "all")}>
            <option value="cow">Cow</option>
            <option value="buffalo">Buffalo</option>
            <option value="all">All</option>
          </select>
        </Field>
        <button
          type="button"
          className={btnGhost}
          onClick={() => {
            try {
              dairy.addChart({
                name,
                kind: "formula",
                milkType,
                fatCoeff: 6.5,
                snfCoeff: 3.8,
                base: 2,
                active: true,
              });
              setSaved(false);
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Add fail");
            }
          }}
        >
          Add chart
        </button>
      </Card>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {charts.map((chart) => (
          <Card key={chart.id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input
                className="font-display w-full bg-transparent text-xl outline-none"
                value={chart.name}
                onChange={(e) => patch(chart.id, { name: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chart.active}
                  onChange={(e) => patch(chart.id, { active: e.target.checked })}
                />
                Active
              </label>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                onClick={() => {
                  if (!confirmAction(`${chart.name} delete karein?`)) return;
                  try {
                    dairy.deleteChart(chart.id);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Delete fail");
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
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

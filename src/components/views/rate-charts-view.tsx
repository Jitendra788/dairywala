"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, Check, ChevronDown, Droplets, Search, Shield, SlidersHorizontal, Sparkles } from "lucide-react";
import {
  chartAxes,
  defaultRules,
  generateBlankGrid,
  fatPointRate,
  generateFatOnlyCells,
  generateFormulaCells,
  isLowKgFatRate,
  kgFatLitreRate,
  METHOD_LABEL,
  methodRowCount,
  milkKey,
  resolvedKgFatRate,
} from "@/lib/rate";
import { formatInr, round2 } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Card, Field, inputClass } from "@/components/ui";
import type { ChartMethod, MilkType, QualityRule, RateChart, Settings } from "@/lib/types";

const METHODS: {
  kind: ChartMethod;
  icon: ReactNode;
  title: string;
  hint: string;
}[] = [
  {
    kind: "fat-only",
    icon: <Droplets size={18} />,
    title: "₹ / kg Fat",
    hint: "Buffalo collection. FAT% × rate point = ₹ / L.",
  },
  {
    kind: "formula",
    icon: <Calculator size={18} />,
    title: "FAT rate table",
    hint: "Har FAT ka alag litre rate. Cow ke liye best.",
  },
  {
    kind: "grid",
    icon: <SlidersHorizontal size={18} />,
    title: "SNF × FAT grid",
    hint: "Cell-by-cell chart jab formula kaafi na ho.",
  },
];

const PREVIEW_FATS = [5.5, 6, 7, 8, 10, 12];

export function RateChartsView() {
  const dairy = useDairy();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState<ChartMethod>(dairy.settings.buffaloMethod ?? dairy.settings.cowMethod ?? "fat-only");
  const [milk, setMilk] = useState<MilkType>("buffalo");
  const [fatPage, setFatPage] = useState(0);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    const nextMilk = searchParams.get("milk");
    if (nextMilk === "cow" || nextMilk === "buffalo") setMilk(nextMilk);
    const method = searchParams.get("method");
    if (method === "fat-only" || method === "formula" || method === "grid") setOpen(method);
  }, [searchParams]);

  function chartOf(kind: ChartMethod, milkType: MilkType) {
    return dairy.charts.find((c) => c.kind === kind && milkKey(c.milkType) === milkType);
  }

  function patch(id: string, next: Partial<RateChart>) {
    dairy.saveCharts(dairy.charts.map((c) => (c.id === id ? { ...c, ...next } : c)));
    setSaved("");
  }

  function usedBy(kind: ChartMethod) {
    const cow = (dairy.settings.cowMethod ?? dairy.settings.rateMethod) === kind;
    const buffalo = (dairy.settings.buffaloMethod ?? "fat-only") === kind;
    if (cow && buffalo) return "Cow + Buffalo";
    if (cow) return "Cow";
    if (buffalo) return "Buffalo";
    return null;
  }

  function useFor(kind: ChartMethod, milkType: MilkType) {
    const patchSettings: Partial<Settings> =
      milkType === "cow" ? { cowMethod: kind, rateMethod: kind } : { buffaloMethod: kind };
    dairy.updateSettings(patchSettings);
    setOpen(kind);
    setMilk(milkType);
    setSaved(`${METHOD_LABEL[kind]} ab ${milkType} collection pe lagega.`);
  }

  const active = METHODS.find((m) => m.kind === open) ?? METHODS[0];
  const buffaloLive = chartOf(dairy.settings.buffaloMethod ?? "fat-only", "buffalo");
  const cowLive = chartOf(dairy.settings.cowMethod ?? dairy.settings.rateMethod ?? "formula", "cow");
  const buffaloPoint = buffaloLive ? fatPointRate(buffaloLive) : 0;
  const buffaloSample = buffaloLive ? kgFatLitreRate(buffaloLive, 5.5) : 0;
  const cowActive = usedBy(active.kind) === "Cow" || usedBy(active.kind) === "Cow + Buffalo";
  const buffaloActive = usedBy(active.kind) === "Buffalo" || usedBy(active.kind) === "Cow + Buffalo";

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-3 sm:space-y-5">
      <section className="relative overflow-hidden rounded-2xl bg-primary px-3.5 py-4 text-white shadow-[0_16px_40px_rgba(24,122,72,0.24)] sm:rounded-3xl sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-8 -top-16 h-44 w-44 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute right-24 -bottom-14 hidden h-28 w-28 rounded-full bg-gold/25 sm:block" />
        <div className="relative flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.18em] text-white/65 uppercase sm:text-[11px]">रेट चार्ट</p>
            <h1 className="mt-1 font-display text-[24px] leading-tight sm:text-[34px] sm:leading-none">Rate desk</h1>
            <p className="mt-1 hidden max-w-lg text-sm text-white/75 sm:mt-2 sm:block">
              Collection isi chart se rate nikalta hai. Buffalo ₹ / kg Fat, cow alag FAT table.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:min-w-[340px] sm:gap-2">
            <HeroStat
              label="Buffalo 5.5%"
              value={buffaloSample ? formatInr(buffaloSample) : "—"}
              hint={buffaloPoint ? `${formatInr(buffaloPoint)} / 1%` : "Chart set karo"}
            />
            <HeroStat
              label="Cow rates"
              value={cowLive?.cells.length ? String(cowLive.cells.length) : "—"}
              hint={cowLive?.cells.length ? "FAT rows ready" : "Table empty"}
            />
          </div>
        </div>
      </section>

      {saved ? (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] font-medium break-words text-primary sm:items-center sm:text-sm">
          <Check size={16} className="mt-0.5 shrink-0 sm:mt-0" />
          {saved}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {METHODS.map((item) => {
          const using = usedBy(item.kind);
          const selected = open === item.kind;
          const rows = methodRowCount(dairy.charts, item.kind, milk);
          return (
            <button
              key={item.kind}
              type="button"
              onClick={() => setOpen(item.kind)}
              className={`min-w-0 rounded-xl border px-1.5 py-2 text-left transition sm:rounded-2xl sm:px-3.5 sm:py-3.5 ${
                selected
                  ? "border-primary bg-card shadow-[0_10px_28px_rgba(24,122,72,0.12)]"
                  : "border-line bg-card/70 hover:border-primary/40 hover:bg-card"
              }`}
            >
              <span className="flex flex-col items-center gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl ${
                    selected ? "bg-primary text-white" : "bg-emerald-50 text-primary"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="min-w-0 text-center sm:text-left">
                  <span className="flex flex-col items-center gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
                    <span className="font-display text-[11px] leading-tight sm:text-[16px]">{item.title}</span>
                    {using ? (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary uppercase sm:text-[10px]">
                        Live
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 hidden text-[12px] text-muted md:block">{item.hint}</span>
                  <span className="mt-2 hidden text-[11px] font-semibold text-foreground/70 md:block">
                    {using ? `In use: ${using}` : "Not used in collection"}
                    {rows ? ` · ${rows} rows` : ""}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Card className="min-w-0 overflow-hidden p-0">
        <div className="flex flex-col gap-2.5 border-b border-line bg-[#fffaf1] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="font-display text-[17px] leading-none sm:text-lg">{active.title}</p>
            <p className="mt-1 hidden text-[12px] text-muted sm:block">{active.hint}</p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-start">
            {(["buffalo", "cow"] as const).map((m) => {
              const selected = milk === m;
              const live = m === "cow" ? cowActive : buffaloActive;
              return (
                <div key={m} className="flex min-w-0 flex-col gap-1.5">
                  <button
                    type="button"
                    className={`min-h-11 w-full rounded-xl px-3 text-[13px] font-semibold capitalize sm:min-h-9 sm:w-auto sm:px-3.5 ${
                      selected
                        ? m === "buffalo"
                          ? "bg-amber-700 text-white"
                          : "bg-sky-700 text-white"
                        : "bg-[#f4ead6] text-muted"
                    }`}
                    onClick={() => {
                      setMilk(m);
                      setFatPage(0);
                    }}
                  >
                    {m}
                  </button>
                  <button
                    type="button"
                    className={`${live ? btnGhost : btnPrimary} min-h-11 w-full px-3 text-[12px] sm:min-h-9 sm:w-auto`}
                    onClick={() => useFor(active.kind, m)}
                  >
                    {live ? `${m === "cow" ? "Cow" : "Buffalo"} live` : `Use for ${m === "cow" ? "Cow" : "Buffalo"}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 px-3 py-3 sm:px-5 sm:py-5">
          {active.kind === "fat-only" ? (
            milk === "cow" ? (
              <FatRowEditor chart={chartOf("fat-only", milk)} onPatch={patch} />
            ) : (
              <FatOnlyEditor chart={chartOf("fat-only", milk)} onPatch={patch} onDone={setSaved} />
            )
          ) : null}
          {active.kind === "formula" ? <FatRowEditor chart={chartOf("formula", milk)} onPatch={patch} /> : null}
          {active.kind === "grid" ? (
            <ManualEditor
              chart={chartOf("grid", milk)}
              fatPage={fatPage}
              onFatPage={setFatPage}
              onPatch={patch}
              onGenerateBlank={() => {
                const current = chartOf("grid", milk);
                if (!current) return;
                patch(current.id, { cells: generateBlankGrid(current) });
                setSaved(`${milk} manual grid ready. Type rates in the cells.`);
              }}
              onCopyFormula={() => {
                const formula = chartOf("formula", milk);
                const current = chartOf("grid", milk);
                if (!formula || !current) return;
                patch(current.id, {
                  fatMin: formula.fatMin,
                  fatMax: formula.fatMax,
                  fatStep: formula.fatStep,
                  snfMin: formula.snfMin,
                  snfMax: formula.snfMax,
                  snfStep: formula.snfStep,
                  cells: generateFormulaCells({ ...formula, kind: "formula" }),
                });
                setSaved(`${milk} manual chart copied from formula. You can edit any cell.`);
              }}
            />
          ) : null}

          {active.kind === "fat-only" && milk === "buffalo" && chartOf(active.kind, milk) ? (
            <RulesEditor chart={chartOf(active.kind, milk)!} onPatch={patch} />
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function HeroStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/10 px-2.5 py-2.5 backdrop-blur-sm sm:rounded-2xl sm:px-3.5 sm:py-3">
      <p className="truncate text-[9px] tracking-wide text-white/65 uppercase sm:text-[10px]">{label}</p>
      <p className="mt-1 truncate font-display text-lg leading-none sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-[10px] text-white/70 sm:mt-1.5 sm:text-[11px]">{hint}</p>
    </div>
  );
}

function FatOnlyEditor({
  chart,
  onPatch,
  onDone,
}: {
  chart?: RateChart;
  onPatch: (id: string, next: Partial<RateChart>) => void;
  onDone?: (message: string) => void;
}) {
  const [trial, setTrial] = useState("6.0");
  const [query, setQuery] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  if (!chart) return null;
  const current = chart;
  const kg = resolvedKgFatRate(current);
  const perPoint = fatPointRate(current);
  const draft: RateChart = { ...current, kgFatRate: kg, fatRate: perPoint };
  const low = isLowKgFatRate(kg);
  const samples = PREVIEW_FATS.filter((fat) => fat >= current.fatMin && fat <= current.fatMax).map((fat) => ({
    fat,
    rate: kgFatLitreRate(draft, fat),
  }));
  const trialFat = Number(trial);
  const trialRate = trialFat > 0 ? kgFatLitreRate(draft, trialFat) : 0;
  const rows = query.trim()
    ? chart.cells.filter((cell) => cell.fat.toFixed(1).includes(query.trim()) || String(cell.fat).includes(query.trim()))
    : chart.cells;

  function applyKg(nextKg: number) {
    const next: RateChart = { ...current, kgFatRate: nextKg, fatRate: fatPointRate({ kgFatRate: nextKg, fatRate: 0 }) };
    onPatch(current.id, {
      kgFatRate: nextKg,
      fatRate: next.fatRate,
      cells: nextKg > 0 ? generateFatOnlyCells(next) : current.cells,
    });
  }

  function generate(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const cells = generateFatOnlyCells(draft);
    onPatch(current.id, { cells });
    onDone?.(`Buffalo FAT chart ready · ${cells.length} rows`);
    window.setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function patchRange(next: Partial<RateChart>) {
    const merged = { ...current, ...next };
    onPatch(current.id, { ...next, cells: generateFatOnlyCells(merged) });
  }

  return (
    <div className="min-w-0 space-y-3 sm:space-y-5">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-2xl border border-line bg-[#fffaf1] p-3 sm:p-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-muted uppercase">Buffalo rate</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <label className="col-span-2">
              <span className="text-[11px] font-medium text-muted">₹ / kg Fat</span>
              <input
                className={`${inputClass} mt-1 font-display text-xl sm:text-2xl md:text-2xl`}
                inputMode="decimal"
                value={kg || ""}
                onChange={(e) => applyKg(Number(e.target.value))}
                placeholder="66"
              />
            </label>
            <div className="col-span-2 sm:col-span-1">
              <Field label="Good SNF min">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={chart.goodSnfMin}
                  onChange={(e) => onPatch(chart.id, { goodSnfMin: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="FAT from">
              <input
                className={inputClass}
                inputMode="decimal"
                value={chart.fatMin}
                onChange={(e) => patchRange({ fatMin: Number(e.target.value) })}
              />
            </Field>
            <Field label="FAT to">
              <input
                className={inputClass}
                inputMode="decimal"
                value={chart.fatMax}
                onChange={(e) => patchRange({ fatMax: Number(e.target.value) })}
              />
            </Field>
          </div>
          {low ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] break-words text-amber-950 sm:text-[13px]">
              ₹{kg} se 6% FAT sirf {formatInr(kgFatLitreRate(draft, 6))} / L — rate check karo.
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-[12px] break-words text-muted sm:text-[13px]">
              {kg > 0 && kg < 200
                ? `₹${kg} desk = ${formatInr(perPoint)} / 1% FAT. Collection: FAT% × ${formatInr(perPoint)}.`
                : `1% FAT = ${formatInr(perPoint)}. Collection: FAT% × ${formatInr(perPoint)}.`}{" "}
              SNF optional.
            </p>
          )}
          <button
            type="button"
            className={`${btnPrimary} mt-3 min-h-12 w-full touch-manipulation sm:min-h-10`}
            onMouseDown={(e) => e.preventDefault()}
            onTouchEnd={generate}
            onClick={generate}
          >
            <Sparkles size={15} />
            Refresh chart
          </button>
        </div>

        <div className="rounded-2xl bg-[#12281e] px-3.5 py-3.5 text-white shadow-[0_12px_28px_rgba(18,40,30,0.18)] sm:px-4 sm:py-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-white/55 uppercase">Live trial</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <label className="min-w-0">
              <span className="text-[11px] text-white/65">FAT %</span>
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-lg text-white outline-none placeholder:text-white/35 focus:border-white/40"
                inputMode="decimal"
                value={trial}
                onChange={(e) => setTrial(e.target.value)}
                placeholder="6.0"
              />
            </label>
            <div className="min-w-0 pb-0.5 text-right">
              <p className="text-[11px] text-white/60">Rate / L</p>
              <p className="font-display text-2xl leading-none sm:text-3xl">{trialFat > 0 ? formatInr(trialRate) : "—"}</p>
              <p className="mt-1 text-[11px] text-white/65">
                {trialFat > 0 ? `${trialFat.toFixed(1)}% × ${formatInr(perPoint)}` : "FAT daalo"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {samples.length ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-6 sm:overflow-visible sm:px-0 sm:pb-0">
          {samples.map((row) => (
            <div key={row.fat} className="min-w-[104px] shrink-0 rounded-2xl border border-line bg-card px-3 py-2.5 sm:min-w-0">
              <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">{row.fat.toFixed(1)}%</p>
              <p className="font-display text-[15px] leading-tight sm:text-lg">{formatInr(row.rate)}</p>
              <p className="text-[10px] text-muted">per litre</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            className={`${inputClass} pl-9`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="FAT dhoondo — 6.5"
          />
        </div>
        <p className="text-[12px] text-muted">
          {rows.length} / {chart.cells.length} rows · {chart.fatMin.toFixed(1)}–{chart.fatMax.toFixed(1)}%
        </p>
      </div>

      {chart.cells.length ? (
        <div ref={tableRef} className="table-scroll max-h-[min(420px,55vh)] overflow-auto rounded-2xl border border-line">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead className="table-head sticky top-0 z-[1] text-[10px] tracking-wider text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">FAT %</th>
                <th className="px-4 py-2.5 font-medium">Rate / L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cell) => {
                const mark = Math.round(cell.fat * 10) % 5 === 0;
                return (
                  <tr key={cell.fat} className={`border-t border-line/70 ${mark ? "bg-emerald-50/70" : "bg-card"}`}>
                    <td className="px-3 py-2 font-semibold sm:px-4">{cell.fat.toFixed(1)}</td>
                    <td className="px-3 py-2 sm:px-4">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-muted">₹</span>
                        <input
                          className="w-full min-w-0 max-w-40 rounded-lg border border-line bg-[#fbf7ef] px-2.5 py-2 text-base outline-none focus:border-primary focus:bg-white sm:py-1.5 sm:text-sm"
                          inputMode="decimal"
                          value={cell.rate}
                          onChange={(e) => {
                            const nextRate = Number(e.target.value);
                            onPatch(chart.id, {
                              cells: chart.cells.map((row) =>
                                row.fat === cell.fat && row.snf === cell.snf ? { ...row, rate: nextRate } : row,
                              ),
                            });
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyBox text="Chart empty hai. ₹ / kg Fat daalo, table khud ban jayegi." />
      )}
    </div>
  );
}

function sameFat(a: number, b: number) {
  return Math.abs(a - b) < 0.001;
}

function FatRowEditor({
  chart,
  onPatch,
}: {
  chart?: RateChart;
  onPatch: (id: string, next: Partial<RateChart>) => void;
}) {
  const [fat, setFat] = useState("");
  const [rate, setRate] = useState("");
  const [editFat, setEditFat] = useState<number | null>(null);
  const [error, setError] = useState("");

  if (!chart) return null;
  const current = chart;
  const rows = [...current.cells].sort((a, b) => a.fat - b.fat);

  function clear() {
    setFat("");
    setRate("");
    setEditFat(null);
    setError("");
  }

  function save(mode: "add" | "update") {
    const nextFat = round2(Number(fat));
    const nextRate = round2(Number(rate));
    if (!nextFat || Number.isNaN(nextRate)) {
      setError("FAT aur Rate dono chahiye.");
      return;
    }
    const match = current.cells.find((c) => sameFat(c.fat, nextFat));
    if (mode === "add" && match) {
      setError("Is FAT ka rate pehle se hai. Update use karo.");
      return;
    }
    if (mode === "update") {
      if (editFat == null && !match) {
        setError("Pehle table se row choose karo, phir Update dabao.");
        return;
      }
    }
    const replace = editFat ?? nextFat;
    const others = current.cells.filter((c) => !sameFat(c.fat, replace) && !sameFat(c.fat, nextFat));
    onPatch(current.id, {
      cells: [...others, { fat: nextFat, snf: current.goodSnfMin || 0, rate: nextRate }],
    });
    clear();
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-2xl border border-line bg-[#fffaf1] p-4">
        <p className="text-[13px] text-muted">Har FAT% ka apna rate. Naya FAT Add karo, purana row Update karo.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="FAT %">
            <input className={inputClass} inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="3.5" />
          </Field>
          <Field label="Rate / L">
            <input className={inputClass} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="38.65" />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={() => save("add")}>
            Add
          </button>
          <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={() => save("update")}>
            Update
          </button>
          {editFat != null ? (
            <button type="button" className={`${btnGhost} col-span-2 w-full sm:col-auto sm:w-auto`} onClick={clear}>
              Cancel
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </div>
      {rows.length ? (
        <>
          <div className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line md:hidden">
            {rows.map((cell) => (
              <div
                key={cell.fat}
                className={`flex items-center gap-3 px-3 py-3 ${editFat != null && sameFat(editFat, cell.fat) ? "bg-emerald-50" : "bg-card"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted">FAT {cell.fat.toFixed(2)}</p>
                  <p className="font-semibold">{formatInr(cell.rate)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    className="min-h-11 rounded-xl border border-line px-3 text-[12px] font-semibold text-primary"
                    onClick={() => {
                      setFat(String(cell.fat));
                      setRate(String(cell.rate));
                      setEditFat(cell.fat);
                      setError("");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-3 text-[12px] font-semibold text-danger"
                    onClick={() => {
                      onPatch(current.id, { cells: current.cells.filter((c) => !sameFat(c.fat, cell.fat)) });
                      if (editFat != null && sameFat(editFat, cell.fat)) clear();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="table-scroll hidden max-h-80 rounded-2xl border border-line md:block">
            <table className="w-full text-left text-sm">
              <thead className="table-head sticky top-0 text-[10px] tracking-wider text-muted uppercase">
                <tr>
                  <th className="px-3 py-2 font-medium">FAT %</th>
                  <th className="px-3 py-2 font-medium">Rate / L</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((cell) => (
                  <tr
                    key={cell.fat}
                    className={`border-t border-line/70 ${editFat != null && sameFat(editFat, cell.fat) ? "bg-emerald-50" : ""}`}
                  >
                    <td className="px-3 py-1.5">{cell.fat.toFixed(2)}</td>
                    <td className="px-3 py-1.5">{formatInr(cell.rate)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        className="mr-2 text-[12px] font-semibold text-primary"
                        onClick={() => {
                          setFat(String(cell.fat));
                          setRate(String(cell.rate));
                          setEditFat(cell.fat);
                          setError("");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-danger"
                        onClick={() => {
                          onPatch(current.id, { cells: current.cells.filter((c) => !sameFat(c.fat, cell.fat)) });
                          if (editFat != null && sameFat(editFat, cell.fat)) clear();
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyBox text="Abhi koi FAT rate nahi. FAT aur Rate daal ke Add karo." />
      )}
    </div>
  );
}

function RulesEditor({
  chart,
  onPatch,
}: {
  chart: RateChart;
  onPatch: (id: string, next: Partial<RateChart>) => void;
}) {
  const [open, setOpen] = useState(false);
  const milk = milkKey(chart.milkType);
  const rules = chart.rules ?? [];

  function setRule(index: number, next: Partial<QualityRule>) {
    onPatch(chart.id, { rules: rules.map((r, i) => (i === index ? { ...r, ...next } : r)) });
  }

  return (
    <div className="mt-6 border-t border-line pt-4">
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
            <Shield size={16} />
          </span>
          <span>
            <span className="block font-display text-lg leading-none">Quality deductions</span>
            <span className="mt-1 block text-[12px] text-muted">
              {rules.length ? `${rules.length} rules · SNF tabhi jab collection pe SNF ho` : "No deductions. Good milk 100%."}
            </span>
          </span>
        </span>
        <ChevronDown size={16} className={`text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={() => onPatch(chart.id, { rules: defaultRules(milk) })}>
              Load Excel
            </button>
            <button
              type="button"
              className={`${btnGhost} w-full sm:w-auto`}
              onClick={() =>
                onPatch(chart.id, {
                  rules: [
                    ...rules,
                    {
                      id: `rule-${crypto.randomUUID().slice(0, 8)}`,
                      label: "New rule",
                      fatMin: null,
                      fatMax: null,
                      snfMin: null,
                      snfMax: null,
                      payPercent: 100,
                    },
                  ],
                })
              }
            >
              Add rule
            </button>
          </div>
          {rules.length === 0 ? (
            <p className="text-sm text-muted">No deductions. Good milk pays 100%.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <div key={rule.id} className="rounded-2xl border border-line bg-[#fffaf1] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input className={inputClass} value={rule.label} onChange={(e) => setRule(i, { label: e.target.value })} />
                    <span className="hidden shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-primary sm:inline">
                      {rule.payPercent}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <BoundField label="FAT min" value={rule.fatMin} onChange={(fatMin) => setRule(i, { fatMin })} />
                    <BoundField label="FAT max" value={rule.fatMax} onChange={(fatMax) => setRule(i, { fatMax })} />
                    <BoundField label="SNF min" value={rule.snfMin} onChange={(snfMin) => setRule(i, { snfMin })} />
                    <BoundField label="SNF max" value={rule.snfMax} onChange={(snfMax) => setRule(i, { snfMax })} />
                    <Field label="Pay %">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={rule.payPercent}
                        onChange={(e) => setRule(i, { payPercent: Number(e.target.value) })}
                      />
                    </Field>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="h-11 w-full rounded-xl border border-line text-sm text-danger"
                        onClick={() => onPatch(chart.id, { rules: rules.filter((_, idx) => idx !== i) })}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BoundField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field label={label}>
      <input
        className={inputClass}
        inputMode="decimal"
        placeholder="any"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </Field>
  );
}

function ManualEditor({
  chart,
  fatPage,
  onFatPage,
  onPatch,
  onGenerateBlank,
  onCopyFormula,
}: {
  chart?: RateChart;
  fatPage: number;
  onFatPage: (page: number) => void;
  onPatch: (id: string, next: Partial<RateChart>) => void;
  onGenerateBlank: () => void;
  onCopyFormula: () => void;
}) {
  const pageSize = 8;
  const fats = useMemo(() => (chart ? chartAxes(chart).fats : []), [chart]);
  const snfs = useMemo(() => (chart ? chartAxes(chart).snfs : []), [chart]);
  if (!chart) return null;
  const current = chart;

  const pages = Math.max(1, Math.ceil(fats.length / pageSize));
  const page = Math.min(fatPage, pages - 1);
  const visibleFats = fats.slice(page * pageSize, page * pageSize + pageSize);
  const rateAt = (fat: number, snf: number) => current.cells.find((c) => c.fat === fat && c.snf === snf)?.rate ?? 0;

  function setCell(fat: number, snf: number, rate: number) {
    const others = current.cells.filter((c) => !(c.fat === fat && c.snf === snf));
    onPatch(current.id, { cells: [...others, { fat, snf, rate }] });
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row">
        <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={onGenerateBlank}>
          Create blank {current.milkType} grid
        </button>
        <button type="button" className={`${btnGhost} w-full sm:w-auto`} onClick={onCopyFormula}>
          Copy from formula
        </button>
      </div>
      {!current.cells.length ? (
        <EmptyBox text="Not set. Create a blank grid or copy the formula chart, then type rates." />
      ) : (
        <>
          <div className="flex flex-col gap-2 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
            <p className="text-center sm:order-2 sm:text-left">
              FAT {visibleFats[0]?.toFixed(1)} – {visibleFats.at(-1)?.toFixed(1)} · {current.cells.length} cells
            </p>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <button type="button" className={`${btnGhost} w-full sm:order-1 sm:w-auto`} disabled={page <= 0} onClick={() => onFatPage(page - 1)}>
                Prev FAT
              </button>
              <button type="button" className={`${btnGhost} w-full sm:order-3 sm:w-auto`} disabled={page >= pages - 1} onClick={() => onFatPage(page + 1)}>
                Next FAT
              </button>
            </div>
          </div>
          <div className="table-scroll max-h-[min(420px,60vh)] rounded-2xl border border-line">
            <table className="min-w-max text-left text-[11px]">
              <thead className="table-head sticky top-0">
                <tr>
                  <th className="sticky left-0 z-10 bg-[#f7f1e6] px-2 py-2 font-medium">FAT \\ SNF</th>
                  {snfs.map((snf) => (
                    <th key={snf} className="px-1 py-2 font-medium">
                      {snf.toFixed(1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleFats.map((fat) => (
                  <tr key={fat} className="border-t border-line/70">
                    <td className="sticky left-0 bg-card px-2 py-1 font-semibold">{fat.toFixed(1)}</td>
                    {snfs.map((snf) => (
                      <td key={`${fat}-${snf}`} className="px-1 py-1">
                        <input
                          className="w-16 rounded-md border border-line bg-[#fbf7ef] px-1 py-1 text-[11px]"
                          inputMode="decimal"
                          value={rateAt(fat, snf)}
                          onChange={(e) => setCell(fat, snf, Number(e.target.value))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-[#fffaf1] px-4 py-8 text-center text-sm text-muted">
      {text}
    </div>
  );
}

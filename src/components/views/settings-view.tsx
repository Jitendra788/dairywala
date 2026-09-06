"use client";

import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Card, Field, inputClass, PageHeader } from "@/components/ui";

export function SettingsView() {
  const dairy = useDairy();
  const s = dairy.settings;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        kicker="सेटिंग"
        title="Dairy settings"
        hint="Centre name slips aur bills par chhapega. Data is browser mein save hota hai — Hamari jaisa offline desk."
      />

      <Card className="space-y-3 p-5">
        <Field label="Dairy name">
          <input
            className={inputClass}
            value={s.dairyName}
            onChange={(e) => dairy.updateSettings({ dairyName: e.target.value })}
          />
        </Field>
        <Field label="Collection centre">
          <input
            className={inputClass}
            value={s.centerName}
            onChange={(e) => dairy.updateSettings({ centerName: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputClass}
            value={s.phone}
            onChange={(e) => dairy.updateSettings({ phone: e.target.value })}
          />
        </Field>
        <Field label="Address">
          <input
            className={inputClass}
            value={s.address}
            onChange={(e) => dairy.updateSettings({ address: e.target.value })}
          />
        </Field>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-xl">Demo data</h2>
        <p className="mt-1 text-sm text-muted">
          Seed farmers, last 10 days ki collection aur ek advance wapas load hoga.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              if (confirm("Saara local data reset ho jayega. Continue?")) dairy.resetDemo();
            }}
          >
            Reset demo dairy
          </button>
          <a href="/plan" className={btnPrimary}>
            Module roadmap
          </a>
        </div>
      </Card>
    </div>
  );
}

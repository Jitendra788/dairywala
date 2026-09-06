"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatInr } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import { btnGhost, btnPrimary, Card, Field, inputClass, PageHeader } from "@/components/ui";
import type { Farmer, MilkType } from "@/lib/types";

const empty = {
  code: "",
  name: "",
  phone: "",
  milkType: "buffalo" as MilkType | "mixed",
  bankName: "",
  accountNo: "",
  ifsc: "",
  upi: "",
};

export function FarmersView() {
  const dairy = useDairy();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  const rows = dairy.farmers.filter((f) => {
    const s = q.toLowerCase();
    return f.code.includes(q) || f.name.toLowerCase().includes(s) || f.phone.includes(q);
  });

  function save() {
    setError("");
    try {
      dairy.addFarmer(form);
      setForm(empty);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="किसान"
        title="Farmers"
        hint="Code se collection hoti hai. Bank / UPI payout ke liye save rakho."
        actions={
          <button type="button" className={btnPrimary} onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Add farmer"}
          </button>
        }
      />

      {open ? (
        <Card className="p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Code">
              <input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Name">
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Milk">
              <select
                className={inputClass}
                value={form.milkType}
                onChange={(e) => setForm({ ...form, milkType: e.target.value as Farmer["milkType"] })}
              >
                <option value="buffalo">Buffalo</option>
                <option value="cow">Cow</option>
                <option value="mixed">Mixed</option>
              </select>
            </Field>
            <Field label="Bank">
              <input className={inputClass} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
            </Field>
            <Field label="Account">
              <input className={inputClass} value={form.accountNo} onChange={(e) => setForm({ ...form, accountNo: e.target.value })} />
            </Field>
            <Field label="IFSC">
              <input className={inputClass} value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} />
            </Field>
            <Field label="UPI">
              <input className={inputClass} value={form.upi} onChange={(e) => setForm({ ...form, upi: e.target.value })} />
            </Field>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <button type="button" className={`${btnPrimary} mt-4`} onClick={save} disabled={!form.code || !form.name}>
            Save farmer
          </button>
        </Card>
      ) : null}

      <Card className="p-5">
        <input
          className={`${inputClass} mb-4 max-w-sm`}
          placeholder="Search code, name, phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="pb-2 font-medium">Code</th>
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Milk</th>
              <th className="pb-2 font-medium">Phone</th>
              <th className="pb-2 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-line">
                <td className="py-2.5 font-mono">{f.code}</td>
                <td>
                  <Link href={`/farmers/${f.id}`} className="font-medium hover:text-primary">
                    {f.name}
                  </Link>
                </td>
                <td className="capitalize">{f.milkType}</td>
                <td>{f.phone || "—"}</td>
                <td>{formatInr(dairy.farmerBalance(f.id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function FarmerProfile() {
  const { id } = useParams<{ id: string }>();
  const dairy = useDairy();
  const farmer = dairy.farmerById(id);
  const [error, setError] = useState("");

  if (!farmer) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        Farmer nahi mila. <Link href="/farmers" className="text-primary">Directory</Link>
      </Card>
    );
  }

  const history = dairy.entries.filter((e) => e.farmerId === farmer.id);
  const advances = dairy.advances.filter((a) => a.farmerId === farmer.id);
  const bills = dairy.bills.filter((b) => b.farmerId === farmer.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker={`Code ${farmer.code}`}
        title={farmer.name}
        hint={`${farmer.phone || "No phone"} · ${farmer.milkType} · ${farmer.upi || farmer.accountNo || "No payout"}`}
        actions={
          <div className="flex gap-2">
            <Link href="/collection" className={btnPrimary}>
              Collect milk
            </Link>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setError("");
                try {
                  dairy.deleteFarmer(farmer.id);
                  window.location.href = "/farmers";
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Cannot delete");
                }
              }}
            >
              Delete
            </button>
          </div>
        }
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Balance" value={formatInr(dairy.farmerBalance(farmer.id))} />
        <Stat label="Slips" value={String(history.length)} />
        <Stat label="Open bills" value={String(bills.filter((b) => b.status === "open").length)} />
      </div>

      <Card className="p-5">
        <h2 className="font-display text-xl">Collection history</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Shift</th>
                <th className="pb-2 font-medium">L</th>
                <th className="pb-2 font-medium">FAT/SNF</th>
                <th className="pb-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 40).map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="py-2">
                    <Link href={`/collection/${e.id}`} className="hover:text-primary">
                      {e.date}
                    </Link>
                  </td>
                  <td>{e.shift}</td>
                  <td>{e.qty}</td>
                  <td>
                    {e.fat} / {e.snf}
                  </td>
                  <td>{formatInr(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-xl">Advances</h2>
          {advances.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No advances</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {advances.map((a) => (
                <li key={a.id} className="flex justify-between border-t border-line pt-2">
                  <span>
                    {a.date} · {a.note || "Advance"}
                    {a.recovered ? " · recovered" : ""}
                  </span>
                  <span>{formatInr(a.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-xl">Bills</h2>
          {bills.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No bills yet</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {bills.map((b) => (
                <li key={b.id} className="flex justify-between border-t border-line pt-2">
                  <Link href={`/payments/bills/${b.id}`} className="hover:text-primary">
                    {b.fromDate} → {b.toDate} · {b.status}
                  </Link>
                  <span>{formatInr(b.net)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </Card>
  );
}

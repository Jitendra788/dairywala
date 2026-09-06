"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { formatInr } from "@/lib/money";
import { useDairy } from "@/hooks/use-dairy";
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  Card,
  Field,
  Initials,
  MilkBadge,
  confirmAction,
  inputClass,
  PageHeader,
} from "@/components/ui";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  const rows = dairy.farmers.filter((f) => {
    const s = q.toLowerCase();
    return f.code.includes(q) || f.name.toLowerCase().includes(s) || f.phone.includes(q);
  });

  function startAdd() {
    setEditingId(null);
    setForm(empty);
    setError("");
    setOpen(true);
  }

  function startEdit(farmer: Farmer) {
    setEditingId(farmer.id);
    setForm({
      code: farmer.code,
      name: farmer.name,
      phone: farmer.phone,
      milkType: farmer.milkType,
      bankName: farmer.bankName,
      accountNo: farmer.accountNo,
      ifsc: farmer.ifsc,
      upi: farmer.upi,
    });
    setError("");
    setOpen(true);
  }

  function save() {
    setError("");
    try {
      if (editingId) dairy.updateFarmer(editingId, form);
      else dairy.addFarmer(form);
      setForm(empty);
      setEditingId(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }

  function remove(id: string, name: string) {
    if (!confirmAction(`${name} delete karein? Unbilled slips bhi hatengi.`)) return;
    try {
      dairy.deleteFarmer(id);
      if (editingId === id) {
        setOpen(false);
        setEditingId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete nahi hua");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        kicker="किसान"
        title="Farmers"
        hint="Add, edit, delete — collection isi code se hoti hai."
        actions={
          <button type="button" className={btnPrimary} onClick={startAdd}>
            Add farmer
          </button>
        }
      />

      {open ? (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">{editingId ? "Update farmer" : "New farmer"}</h2>
            <button type="button" className="text-xs text-muted" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
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
          <div className="mt-4 flex gap-2">
            <button type="button" className={btnPrimary} onClick={save} disabled={!form.code || !form.name}>
              {editingId ? "Update farmer" : "Save farmer"}
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setOpen(false);
                setEditingId(null);
                setForm(empty);
              }}
            >
              Cancel
            </button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line p-4">
          <input
            className={`${inputClass} max-w-full sm:max-w-sm`}
            placeholder="Search code, name, phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="divide-y divide-line/70 md:hidden">
          {rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted">Koi farmer nahi mila.</p> : null}
          {rows.map((f) => (
            <div key={f.id} className="flex items-start gap-3 px-4 py-3">
              <Link href={`/farmers/${f.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                <Initials name={f.name} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="font-mono text-[11px] text-muted">{f.code} · {f.phone || "—"}</span>
                </span>
              </Link>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-semibold">{formatInr(dairy.farmerBalance(f.id))}</p>
                <div className="mt-1">
                  <button type="button" className="mr-1 rounded-lg p-1.5 text-muted hover:bg-[#f4ead6] hover:text-primary" onClick={() => startEdit(f)} aria-label="Edit">
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger" onClick={() => remove(f.id, f.name)} aria-label="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <table className="hidden w-full text-left text-sm md:table">
          <thead className="table-head text-[10px] tracking-wider text-muted uppercase">
            <tr>
              <th className="px-4 py-2.5 font-medium">Farmer</th>
              <th className="py-2.5 font-medium">Milk</th>
              <th className="py-2.5 font-medium">Phone</th>
              <th className="py-2.5 font-medium">Balance</th>
              <th className="px-4 py-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-line/70 hover:bg-[#faf6ee]">
                <td className="px-4 py-2.5">
                  <Link href={`/farmers/${f.id}`} className="flex items-center gap-2 hover:text-primary">
                    <Initials name={f.name} />
                    <span>
                      <span className="block font-medium">{f.name}</span>
                      <span className="font-mono text-[11px] text-muted">{f.code}</span>
                    </span>
                  </Link>
                </td>
                <td>
                  <MilkBadge type={f.milkType} />
                </td>
                <td>{f.phone || "—"}</td>
                <td className="font-semibold">{formatInr(dairy.farmerBalance(f.id))}</td>
                <td className="px-4 text-right">
                  <button type="button" className="mr-1 rounded-lg p-1.5 text-muted hover:bg-[#f4ead6] hover:text-primary" onClick={() => startEdit(f)} aria-label="Edit">
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger" onClick={() => remove(f.id, f.name)} aria-label="Delete">
                    <Trash2 size={14} />
                  </button>
                </td>
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
  const router = useRouter();
  const dairy = useDairy();
  const farmer = dairy.farmerById(id);
  const [error, setError] = useState("");
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!farmer) return;
    setForm({
      code: farmer.code,
      name: farmer.name,
      phone: farmer.phone,
      milkType: farmer.milkType,
      bankName: farmer.bankName,
      accountNo: farmer.accountNo,
      ifsc: farmer.ifsc,
      upi: farmer.upi,
    });
  }, [farmer?.id]);

  if (!farmer) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        Farmer nahi mila. <Link href="/farmers" className="text-primary">Directory</Link>
      </Card>
    );
  }

  const history = dairy.entries.filter((e) => e.farmerId === farmer.id);
  const bills = dairy.bills.filter((b) => b.farmerId === farmer.id);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        kicker={`Code ${farmer.code}`}
        title={farmer.name}
        hint="Yahan se farmer update ya delete kar sakte ho."
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link href="/collection" className={`${btnPrimary} flex-1 sm:flex-none`}>
              Collect milk
            </Link>
            <button
              type="button"
              className={btnDanger}
              onClick={() => {
                if (!confirmAction(`${farmer.name} delete karein?`)) return;
                try {
                  dairy.deleteFarmer(farmer.id);
                  router.push("/farmers");
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

      <Card className="p-5">
        <h2 className="font-display text-lg">Update details</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
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
        <button
          type="button"
          className={`${btnPrimary} mt-4`}
          onClick={() => {
            setError("");
            try {
              dairy.updateFarmer(farmer.id, form);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Update fail");
            }
          }}
        >
          Update farmer
        </button>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Balance" value={formatInr(dairy.farmerBalance(farmer.id))} />
        <Stat label="Slips" value={String(history.length)} />
        <Stat label="Open bills" value={String(bills.filter((b) => b.status === "open").length)} />
      </div>

      <Card className="p-5">
        <h2 className="font-display text-lg">Collection history</h2>
        <div className="table-scroll mt-3">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="table-head text-[10px] uppercase text-muted">
            <tr>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="py-2 font-medium">Shift</th>
              <th className="py-2 font-medium">L</th>
              <th className="py-2 font-medium">FAT/SNF</th>
              <th className="py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {history.slice(0, 40).map((e) => (
              <tr key={e.id} className="border-t border-line/70">
                <td className="px-2 py-2">
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

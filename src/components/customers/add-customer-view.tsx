"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { customerApi } from "@/lib/customers/client";
import { todayISO } from "@/lib/dates";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, Card, Field, inputClass, PageHeader, Select } from "@/components/ui";
import type { CustomerMilkType, CustomerStatus, CustomerType, PaymentCycle } from "@/lib/customers/types";

const empty = {
  customerCode: "",
  name: "",
  mobile: "",
  address: "",
  milkType: "buffalo" as CustomerMilkType,
  customerType: "regular" as CustomerType,
  dailyQty: "2",
  rate: "",
  startDate: todayISO(),
  deliveryTime: "06:30",
  paymentCycle: "monthly" as PaymentCycle,
  status: "active" as CustomerStatus,
};

export function AddCustomerView() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [nextCode, setNextCode] = useState("CUS-****");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const walkin = form.customerType === "walkin";

  useEffect(() => {
    customerApi<{ nextCode: string }>("/api/customers")
      .then((data) => {
        setNextCode(data.nextCode);
        setForm((current) => (current.customerCode ? current : { ...current, customerCode: data.nextCode }));
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setError("");
    setBusy(true);
    try {
      const data = await customerApi<{ customer: { id: string; customerCode: string; name: string; customerType: CustomerType } }>(
        "/api/customers",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            dailyQty: walkin ? Number(form.dailyQty) || undefined : Number(form.dailyQty),
            rate: walkin ? Number(form.rate) || undefined : Number(form.rate),
          }),
        },
      );
      toast.push(`${data.customer.customerCode} ${data.customer.name} created`);
      if (data.customer.customerType === "walkin") {
        router.push(`/customers/walk-in?customerId=${data.customer.id}`);
      } else {
        router.push("/customers");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save customer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        kicker="नया ग्राहक"
        title="Add Customer"
        hint="Regular customers get a daily subscription. Daily / walk-in customers are saved once and billed only when they buy milk."
      />
      <Card className="p-5">
        <div className="mb-4 grid grid-cols-2 gap-2">
          {(["regular", "walkin"] as const).map((type) => (
            <button
              key={type}
              type="button"
              className={`rounded-2xl border px-3 py-3 text-left ${
                form.customerType === type ? "border-primary bg-emerald-50 text-primary" : "border-line bg-white"
              }`}
              onClick={() => setForm({ ...form, customerType: type })}
            >
              <span className="block text-sm font-semibold">{type === "regular" ? "Regular Customer" : "Daily / Walk-in"}</span>
              <span className="mt-1 block text-[11px] text-muted">
                {type === "regular" ? "Fixed daily quantity and monthly billing" : "No compulsory subscription. Sell only when they come."}
              </span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Customer code">
            <input
              className={inputClass}
              value={form.customerCode}
              onChange={(e) => setForm({ ...form, customerCode: e.target.value })}
              placeholder={nextCode}
            />
          </Field>
          <Field label="Customer name">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ramesh" />
          </Field>
          <Field label="Mobile (optional)">
            <input className={inputClass} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="9876502001" inputMode="numeric" />
          </Field>
          <Field label="Address (optional)">
            <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House / street / village" />
          </Field>
          <Field label="Milk type">
            <Select className={inputClass} value={form.milkType} onChange={(e) => setForm({ ...form, milkType: e.target.value as CustomerMilkType })}>
              <option value="cow">Cow</option>
              <option value="buffalo">Buffalo</option>
              <option value="mixed">Mixed</option>
            </Select>
          </Field>
          {walkin ? (
            <>
              <Field label="Default quantity (optional)">
                <input className={inputClass} type="number" min="0" step="0.1" value={form.dailyQty} onChange={(e) => setForm({ ...form, dailyQty: e.target.value })} />
              </Field>
              <Field label="Default rate (optional)">
                <input className={inputClass} type="number" min="0" step="0.5" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Daily quantity (L)">
                <input className={inputClass} type="number" min="0.1" step="0.1" value={form.dailyQty} onChange={(e) => setForm({ ...form, dailyQty: e.target.value })} />
              </Field>
              <Field label="Milk rate (₹/L) (optional)">
                <input className={inputClass} type="number" min="0" step="0.5" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </Field>
              <Field label="Delivery start date (optional)">
                <input className={inputClass} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </Field>
              <Field label="Delivery time (optional)">
                <input className={inputClass} type="time" value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} />
              </Field>
              <Field label="Payment cycle (optional)">
                <Select className={inputClass} value={form.paymentCycle} onChange={(e) => setForm({ ...form, paymentCycle: e.target.value as PaymentCycle })}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="10-day">10-day</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </Field>
              <Field label="Status (optional)">
                <Select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CustomerStatus })}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="stopped">Stopped</option>
                </Select>
              </Field>
            </>
          )}
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !form.customerCode.trim() || form.name.trim().length < 2 || (!walkin && !(Number(form.dailyQty) > 0))}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : walkin ? "Create and sell milk" : "Create customer"}
          </button>
          <button type="button" className={btnGhost} onClick={() => router.push("/customers")}>
            Cancel
          </button>
        </div>
      </Card>
    </div>
  );
}

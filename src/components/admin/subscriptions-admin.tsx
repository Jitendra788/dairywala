"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatInr } from "@/lib/money";
import type { PlatformPaymentRow, PlatformPlan, PlatformSubscription, PlatformUser } from "@/lib/platform/types";
import { useToast } from "@/components/toast";
import { btnPrimary, inputClass } from "@/components/ui";
import { AdminStatus, EmptyState, LoadingState, Panel, platformAct, usePlatform } from "@/components/admin/admin-kit";
import { useI18n } from "@/hooks/use-i18n";

export function SubscriptionsAdmin({ tab = "plans" }: { tab?: string }) {
  const { t } = useI18n();
  const subs = usePlatform<{ plans: PlatformPlan[]; subscriptions: PlatformSubscription[]; payments: PlatformPaymentRow[] }>("subscriptions");
  const dairies = usePlatform<{ users: PlatformUser[] }>("dairies");
  const { push } = useToast();
  const [dairyId, setDairyId] = useState("");
  const [planId, setPlanId] = useState("plan-basic");
  const [coupon, setCoupon] = useState("");

  const list = useMemo(() => {
    const rows = subs.data?.subscriptions || [];
    if (tab === "active") return rows.filter((r) => r.status === "active" || r.status === "trial");
    if (tab === "expiring") return rows.filter((r) => r.status === "expiring");
    if (tab === "expired") return rows.filter((r) => r.status === "expired");
    return rows;
  }, [subs.data, tab]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">{t("saas")}</p>
        <h1 className="font-display text-[26px] leading-none">{t("subscriptions")}</h1>
      </div>
      {subs.loading ? <LoadingState /> : null}
      {subs.error ? <p className="text-sm text-danger">{subs.error}</p> : null}

      {tab === "plans" || tab === "" ? (
        <div className="grid gap-3 md:grid-cols-3">
          {(subs.data?.plans || []).map((plan) => (
            <div key={plan.id} className="rounded-2xl border border-line bg-card p-4">
              <p className="font-display text-2xl">{plan.name}</p>
              <p className="mt-1 text-primary">{formatInr(plan.priceMonthly)} / month</p>
              <p className="mt-2 text-[13px] text-muted">Users: {plan.userLimit || "Unlimited"}</p>
              <p className="text-[13px] text-muted">Customers: {plan.customerLimit || "Unlimited"}</p>
              <p className="text-[13px] text-muted">Trial: {plan.trialDays} days</p>
              <p className="mt-2 text-sm">{plan.features}</p>
            </div>
          ))}
        </div>
      ) : null}

      {tab !== "payments" ? (
        <Panel title={tab === "plans" ? "All subscriptions" : tab}>
          {list.length === 0 ? <EmptyState text="Koi subscription nahi" /> : (
            <div className="table-scroll">
              <table className="min-w-full text-left text-[13px]">
                <thead className="table-head text-muted">
                  <tr>
                    {["Dairy", "Plan", "Price", "Users", "Customers", "Expiry", "Status"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="px-3 py-2">{row.dairyName}</td>
                      <td className="px-3 py-2">{row.planName}</td>
                      <td className="px-3 py-2">{formatInr(row.priceMonthly * (1 - row.discount / 100))}</td>
                      <td className="px-3 py-2">{row.userLimit || "∞"}</td>
                      <td className="px-3 py-2">{row.customerLimit || "∞"}</td>
                      <td className="px-3 py-2">{row.expiresAt ? formatDate(row.expiresAt) : "—"}</td>
                      <td className="px-3 py-2"><AdminStatus status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <Panel title="Payment history">
          {(subs.data?.payments || []).length === 0 ? <EmptyState text="Manual renewal ke baad history yahan aayegi" /> : (
            <ul className="divide-y divide-line text-sm">
              {subs.data?.payments.map((p) => (
                <li key={p.id} className="flex justify-between px-4 py-2">
                  <span>{p.dairyName} · {p.note}</span>
                  <span>{formatInr(p.amount)} · {formatDate(p.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel title="Manual renewal / coupon">
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <select className={inputClass} value={dairyId} onChange={(e) => setDairyId(e.target.value)}>
            <option value="">Dairy</option>
            {(dairies.data?.users || []).filter((d) => d.dairyId).map((d) => (
              <option key={d.id} value={d.dairyId || ""}>{d.dairyName}</option>
            ))}
          </select>
          <select className={inputClass} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {(subs.data?.plans || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className={inputClass} placeholder="Coupon e.g. WELCOME20" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
          <button
            type="button"
            className={btnPrimary}
            onClick={() => void platformAct({ op: "assignPlan", dairyId, planId, couponCode: coupon }).then(() => { push("Renewed"); void subs.reload(); }).catch((e) => push(e instanceof Error ? e.message : "Fail", "err"))}
          >
            Renew
          </button>
        </div>
        <p className="px-4 pb-3 text-[12px] text-muted">Default coupon: WELCOME20 (20% off). Trial auto-assign Basic plan.</p>
      </Panel>
    </div>
  );
}

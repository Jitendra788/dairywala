"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { startImpersonation } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import type { PlatformUser } from "@/lib/platform/types";
import { DAIRY_CATEGORIES } from "@/lib/platform/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useI18n } from "@/hooks/use-i18n";
import type { DictKey } from "@/lib/i18n/dict";
import { useToast } from "@/components/toast";
import { btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/ui";
import {
  AdminStatus,
  Drawer,
  EmptyState,
  LoadingState,
  pager,
  platformAct,
  usePlatform,
} from "@/components/admin/admin-kit";

const FILTERS: Array<{ id: string; labelKey: DictKey }> = [
  { id: "all", labelKey: "all" },
  { id: "pending", labelKey: "pending" },
  { id: "active", labelKey: "active" },
  { id: "suspended", labelKey: "suspended" },
  { id: "cancelled", labelKey: "cancelled" },
];

function canDelete(user: PlatformUser) {
  return user.dairyId !== "tony-dairy" && user.id !== "desk:tony-dairy";
}

function when(value: string | null) {
  if (!value) return "—";
  return `${formatDate(value)} ${formatTime(value)}`;
}

export function DairiesAdmin({ status = "all" }: { status?: string }) {
  const { t } = useI18n();
  const { data, error, loading, reload } = usePlatform<{ users: PlatformUser[] }>("dairies");
  const { push } = useToast();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<PlatformUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState<{ op: string; id: string; title: string; danger?: boolean } | null>(null);
  const [form, setForm] = useState({ dairyName: "", name: "", phone: "", address: "", category: "", planId: "" });

  const rows = useMemo(() => {
    const users = data?.users || [];
    return users.filter((user) => {
      const st = user.status === "blocked" ? "suspended" : user.status;
      if (status !== "all" && st !== status) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [user.dairyName, user.name, user.email, user.phone, user.location, user.planName]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [data, status, query]);

  const paged = pager(rows, page, 10);

  async function run(op: string, id: string, extra: Record<string, unknown> = {}) {
    setBusy(id + op);
    try {
      await platformAct({ op, id, ...extra });
      push(op === "delete" ? "Dairy delete ho gayi" : "Saved");
      setConfirm(null);
      setEditing(false);
      if (op === "delete") setOpen((cur) => (cur?.id === id ? null : cur));
      await reload(true);
    } catch (err) {
      push(err instanceof Error ? err.message : "Fail", "err");
    } finally {
      setBusy("");
    }
  }

  async function loginAs(user: PlatformUser) {
    setBusy(user.id + "imp");
    try {
      const payload = await platformAct({ op: "impersonate", id: user.id }) as {
        dairyId: string;
        username: string;
        email?: string;
        name?: string;
        dairyName?: string;
      };
      startImpersonation(payload);
      router.replace("/");
    } catch (err) {
      push(err instanceof Error ? err.message : "Login as dairy fail", "err");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">{t("dairyManagement")}</p>
        <h1 className="font-display text-[26px] leading-none">{t("adminDairies")}</h1>
        <p className="mt-1 text-[13px] text-muted">{t("dairiesHint")}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input className={`${inputClass} sm:max-w-xs`} placeholder={t("searchDairy")} value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <a key={item.id} href={item.id === "all" ? "/admin/dairies" : `/admin/dairies?status=${item.id}`} className={status === item.id ? btnPrimary : btnGhost}>
              {t(item.labelKey)}
            </a>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {loading ? (
        <LoadingState />
      ) : paged.rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card">
          <EmptyState text={t("noDairies")} />
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-card lg:block">
            <div className="table-scroll">
              <table className="min-w-full text-left text-[13px]">
                <thead className="table-head text-muted">
                  <tr>
                    {[t("colDairy"), t("colOwner"), t("colContact"), t("colPlan"), t("colStatus"), t("colFarmers"), t("colCustomers"), t("colToday"), t("colLastLogin"), ""].map((h) => (
                      <th key={h} className="px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((user) => (
                    <tr key={user.id} className="border-t border-line">
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{user.dairyName || "—"}</p>
                        <p className="text-[11px] text-muted">{user.location || user.centerName || "—"}</p>
                      </td>
                      <td className="px-3 py-2.5">{user.name || "—"}</td>
                      <td className="px-3 py-2.5">
                        <p>{user.phone || "—"}</p>
                        <p className="text-[11px] text-muted">{user.email || "desk"}</p>
                      </td>
                      <td className="px-3 py-2.5">{user.planName || "Basic"}</td>
                      <td className="px-3 py-2.5"><AdminStatus status={user.status} /></td>
                      <td className="px-3 py-2.5">{user.farmers}</td>
                      <td className="px-3 py-2.5">{user.customers}</td>
                      <td className="px-3 py-2.5">{formatQty(user.todayQty)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{when(user.lastLoginAt)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" className={btnGhost} onClick={() => { setOpen(user); setEditing(false); }}>View</button>
                          {canDelete(user) ? (
                            <button
                              type="button"
                              className={btnDanger}
                              disabled={busy !== ""}
                              onClick={() => setConfirm({ op: "delete", id: user.id, title: `${user.dairyName || "Dairy"} delete karni hai? Wapas nahi aayegi.`, danger: true })}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-3 lg:hidden">
            {paged.rows.map((user) => (
              <div key={user.id} className="rounded-2xl border border-line bg-card p-4">
                <button type="button" className="w-full text-left" onClick={() => setOpen(user)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg">{user.dairyName || user.name}</p>
                    <AdminStatus status={user.status} />
                  </div>
                  <p className="mt-1 text-[12px] text-muted">{user.name} · {user.phone || user.email || "desk"}</p>
                  <p className="mt-2 text-[12px]">{user.farmers} farmers · {formatQty(user.todayQty)} aaj</p>
                </button>
                {canDelete(user) ? (
                  <button
                    type="button"
                    className={`${btnDanger} mt-3 w-full`}
                    disabled={busy !== ""}
                    onClick={() => setConfirm({ op: "delete", id: user.id, title: `${user.dairyName || "Dairy"} delete karni hai? Wapas nahi aayegi.`, danger: true })}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <p className="text-muted">{rows.length} dairies</p>
            <div className="flex gap-2">
              <button type="button" className={btnGhost} disabled={paged.page <= 1} onClick={() => setPage((n) => n - 1)}>{t("prev")}</button>
              <button type="button" className={btnGhost} disabled={paged.page >= paged.pages} onClick={() => setPage((n) => n + 1)}>{t("next")}</button>
            </div>
          </div>
        </>
      )}

      <Drawer
        open={Boolean(open)}
        title={open?.dairyName || "Dairy"}
        onClose={() => { setOpen(null); setEditing(false); }}
      >
        {open ? (
          <div className="space-y-3 text-sm">
            {editing ? (
              <div className="space-y-2">
                {(["dairyName", "name", "phone", "address"] as const).map((key) => (
                  <label key={key} className="block">
                    <span className="text-[11px] text-muted">{key}</span>
                    <input className={inputClass} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                  </label>
                ))}
                <select className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {DAIRY_CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button type="button" className={btnPrimary} disabled={busy !== ""} onClick={() => void run("edit", open.id, form)}>Save</button>
                  <button type="button" className={btnGhost} onClick={() => setEditing(false)}>Back</button>
                </div>
              </div>
            ) : (
              <>
                <p><span className="text-muted">Owner:</span> {open.name || "—"}</p>
                <p><span className="text-muted">Mobile:</span> {open.phone || "—"}</p>
                <p><span className="text-muted">Email:</span> {open.email || "desk account"}</p>
                <p><span className="text-muted">Location:</span> {open.location || "—"}</p>
                <p><span className="text-muted">Plan:</span> {open.planName || "Basic"} · {open.planStatus || "trial"}</p>
                <p><span className="text-muted">Users / farmers / customers:</span> {open.usersCount} / {open.farmers} / {open.customers}</p>
                <p><span className="text-muted">Today collection:</span> {formatQty(open.todayQty)}</p>
                <p><span className="text-muted">Total milk / paisa:</span> {formatQty(open.collectionQty)} · {formatInr(open.moneyIn)}</p>
                <p><span className="text-muted">Created:</span> {when(open.createdAt)}</p>
                <p><span className="text-muted">Last login:</span> {when(open.lastLoginAt)}</p>
                {open.otpCode ? <p><span className="text-muted">OTP:</span> {open.otpCode}</p> : null}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <button type="button" className={btnGhost} onClick={() => { setForm({ dairyName: open.dairyName, name: open.name, phone: open.phone, address: open.location, category: open.category, planId: open.planId }); setEditing(true); }}>Edit</button>
                  {open.status === "pending" || open.status === "blocked" || open.status === "cancelled" ? (
                    <button type="button" className={btnGhost} disabled={busy !== ""} onClick={() => void run("activate", open.id)}>Activate</button>
                  ) : (
                    <button type="button" className={btnDanger} onClick={() => setConfirm({ op: "suspend", id: open.id, title: "Dairy suspend karni hai?" })}>Suspend</button>
                  )}
                  {open.status !== "cancelled" ? (
                    <button type="button" className={btnDanger} onClick={() => setConfirm({ op: "cancel", id: open.id, title: "Dairy cancel karni hai?", danger: true })}>Cancel</button>
                  ) : null}
                  {canDelete(open) ? (
                    <button type="button" className={btnDanger} onClick={() => setConfirm({ op: "delete", id: open.id, title: "Dairy delete? Wapas nahi aayegi.", danger: true })}>Delete</button>
                  ) : (
                    <p className="text-[12px] text-muted">Owner desk delete nahi hoti.</p>
                  )}
                  <button type="button" className={btnPrimary} disabled={busy !== ""} onClick={() => setConfirm({ op: "impersonate", id: open.id, title: `Login as ${open.dairyName}? Impersonation banner dikhega.` })}>
                    Login as Dairy
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title || ""}
        danger={confirm?.danger}
        busy={busy !== ""}
        confirmLabel={confirm?.op === "impersonate" ? "Enter dairy" : "Confirm"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.op === "impersonate") {
            const target = open && open.id === confirm.id ? open : (data?.users || []).find((item) => item.id === confirm.id);
            if (target) void loginAs(target);
            return;
          }
          void run(confirm.op, confirm.id);
        }}
      >
        Ye action audit log mein save hoga.
      </ConfirmDialog>
    </div>
  );
}

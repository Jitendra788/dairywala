"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";
import type { PlatformPermission, PlatformStaff, PlatformUser } from "@/lib/platform/types";
import { PLATFORM_MODULES, STAFF_ROLES } from "@/lib/platform/types";
import { useToast } from "@/components/toast";
import { btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/ui";
import { AdminStatus, EmptyState, LoadingState, Panel, platformAct, usePlatform } from "@/components/admin/admin-kit";
import { useI18n } from "@/hooks/use-i18n";

export function UsersAdmin() {
  const { t } = useI18n();
  const { data, error, loading, reload } = usePlatform<{ dairies: PlatformUser[]; staff: PlatformStaff[]; permissions: PlatformPermission[] }>("users");
  const { push } = useToast();
  const [form, setForm] = useState({ dairyId: "", name: "", email: "", phone: "", role: "manager" });
  const dairies = data?.dairies || [];
  const staff = data?.staff || [];
  const matrix = data?.permissions || [];
  const owners = useMemo(
    () => [
      { id: "super", name: "Super admin", email: "admin", role: "super_admin", dairy: "Platform", status: "active", lastLogin: "—", device: "Web" },
      ...dairies.map((d) => ({
        id: d.id,
        name: d.name || d.username,
        email: d.email || d.username,
        role: "dairy_owner",
        dairy: d.dairyName,
        status: d.status === "blocked" ? "inactive" : d.status === "active" ? "active" : d.status,
        lastLogin: d.lastLoginAt ? formatDate(d.lastLoginAt) : "—",
        device: d.lastDevice || "Web",
      })),
      ...staff.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
        dairy: s.dairyName,
        status: s.status,
        lastLogin: s.lastLoginAt ? formatDate(s.lastLoginAt) : "—",
        device: s.lastDevice,
      })),
    ],
    [dairies, staff],
  );

  async function saveStaff() {
    try {
      await platformAct({ op: "staffSave", ...form });
      push("Staff saved");
      setForm({ dairyId: "", name: "", email: "", phone: "", role: "manager" });
      await reload();
    } catch (err) {
      push(err instanceof Error ? err.message : "Fail", "err");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">{t("access")}</p>
        <h1 className="font-display text-[26px] leading-none">{t("usersRoles")}</h1>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {loading ? <LoadingState /> : (
        <>
          <Panel title={t("everyone")}>
            {owners.length === 0 ? <EmptyState text="No users" /> : (
              <div className="table-scroll">
                <table className="min-w-full text-left text-[13px]">
                  <thead className="table-head text-muted">
                    <tr>
                      {["User", "Role", "Dairy", "Status", "Last login", "Device"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {owners.map((row) => (
                      <tr key={row.id} className="border-t border-line">
                        <td className="px-3 py-2"><p className="font-medium">{row.name}</p><p className="text-[11px] text-muted">{row.email}</p></td>
                        <td className="px-3 py-2 capitalize">{row.role.replace("_", " ")}</td>
                        <td className="px-3 py-2">{row.dairy}</td>
                        <td className="px-3 py-2"><AdminStatus status={row.status} /></td>
                        <td className="px-3 py-2">{row.lastLogin}</td>
                        <td className="px-3 py-2">{row.device}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <Panel title={t("addStaff")}>
            <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <select className={inputClass} value={form.dairyId} onChange={(e) => setForm((f) => ({ ...f, dairyId: e.target.value }))}>
                <option value="">Dairy</option>
                {dairies.filter((d) => d.dairyId).map((d) => (
                  <option key={d.id} value={d.dairyId || ""}>{d.dairyName}</option>
                ))}
              </select>
              <input className={inputClass} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <input className={inputClass} placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <input className={inputClass} placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <select className={inputClass} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {STAFF_ROLES.filter((r) => r !== "super_admin" && r !== "dairy_owner").map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="button" className={btnPrimary} onClick={() => void saveStaff()}>Add staff</button>
            </div>
            {staff.length ? (
              <ul className="divide-y divide-line border-t border-line text-sm">
                {staff.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                    <span>{s.name} · {s.role} · {s.dairyName}</span>
                    <button type="button" className={btnDanger} onClick={() => void platformAct({ op: "staffDelete", id: s.id }).then(reload)}>Delete</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
          <Panel title={t("permissionMatrix")}>
            <div className="table-scroll">
              <table className="min-w-full text-left text-[12px]">
                <thead className="table-head text-muted">
                  <tr>
                    <th className="px-3 py-2">Module</th>
                    {STAFF_ROLES.map((role) => <th key={role} className="px-3 py-2 capitalize">{role.replace("_", " ")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PLATFORM_MODULES.map((mod) => (
                    <tr key={mod} className="border-t border-line">
                      <td className="px-3 py-2 font-medium">{mod}</td>
                      {STAFF_ROLES.map((role) => {
                        const allowed = matrix.some((p) => p.role === role && p.module === mod && p.allowed);
                        return (
                          <td key={role} className="px-3 py-2">
                            <button
                              type="button"
                              className={allowed ? btnPrimary : btnGhost}
                              onClick={() => void platformAct({ op: "permission", role, module: mod, allowed: !allowed }).then(reload)}
                            >
                              {allowed ? "On" : "Off"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

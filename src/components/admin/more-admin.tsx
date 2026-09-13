"use client";

import { useState } from "react";
import { addDays, formatDate, todayISO } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import type { PlatformAudit, PlatformBackupRow, PlatformHealth, PlatformNotice, PlatformTicket } from "@/lib/platform/types";
import { useToast } from "@/components/toast";
import { btnGhost, btnPrimary, inputClass } from "@/components/ui";
import { AdminStatus, BarChart, EmptyState, LineChart, LoadingState, Panel, platformAct, usePlatform } from "@/components/admin/admin-kit";
import { useI18n } from "@/hooks/use-i18n";

export function AnalyticsAdmin() {
  const { t } = useI18n();
  const [from, setFrom] = useState(addDays(todayISO(), -30));
  const [to, setTo] = useState(todayISO());
  const { data, loading, error } = usePlatform<{ milk: { label: string; value: number }[]; revenue: { label: string; value: number }[]; registrations: { label: string; value: number }[] }>("analytics", `&from=${from}&to=${to}`);
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">{t("insights")}</p>
        <h1 className="font-display text-[26px] leading-none">{t("analytics")}</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={t("milkCollection")}><LineChart data={data?.milk || []} /></Panel>
        <Panel title={t("revenue")}><LineChart data={data?.revenue || []} /></Panel>
        <Panel title={t("registrations")}><BarChart data={data?.registrations || []} /></Panel>
        <Panel title="Totals">
          <div className="grid grid-cols-2 gap-3 p-4 text-sm">
            <p>Milk · <b>{formatQty((data?.milk || []).reduce((s, r) => s + r.value, 0))}</b></p>
            <p>Revenue · <b>{formatInr((data?.revenue || []).reduce((s, r) => s + r.value, 0))}</b></p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function SupportAdmin() {
  const { t } = useI18n();
  const { data, loading, error, reload } = usePlatform<{ tickets: PlatformTicket[] }>("tickets");
  const { push } = useToast();
  const [form, setForm] = useState({ dairyName: "", userName: "", subject: "", priority: "medium", message: "" });
  const [filter, setFilter] = useState("all");
  const rows = (data?.tickets || []).filter((t) => filter === "all" || t.status === filter);
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">{t("support")}</p>
        <h1 className="font-display text-[26px] leading-none">{t("tickets")}</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {["all", "open", "progress", "resolved", "closed"].map((id) => (
          <button key={id} type="button" className={filter === id ? btnPrimary : btnGhost} onClick={() => setFilter(id)}>{id === "progress" ? "In progress" : id}</button>
        ))}
      </div>
      <Panel title="New ticket">
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          <input className={inputClass} placeholder="Dairy" value={form.dairyName} onChange={(e) => setForm((f) => ({ ...f, dairyName: e.target.value }))} />
          <input className={inputClass} placeholder="User" value={form.userName} onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))} />
          <input className={inputClass} placeholder="Subject" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          <select className={inputClass} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
            {["low", "medium", "high", "urgent"].map((p) => <option key={p}>{p}</option>)}
          </select>
          <textarea className={`${inputClass} sm:col-span-2`} rows={3} placeholder="Message" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
          <button type="button" className={btnPrimary} onClick={() => void platformAct({ op: "ticketSave", ...form }).then(() => { push("Ticket opened"); setForm({ dairyName: "", userName: "", subject: "", priority: "medium", message: "" }); void reload(); })}>Create</button>
        </div>
      </Panel>
      {loading ? <LoadingState /> : error ? <p className="text-sm text-danger">{error}</p> : (
        <Panel title={`${rows.length} tickets`}>
          {rows.length === 0 ? <EmptyState text="Koi ticket nahi" /> : (
            <ul className="divide-y divide-line text-sm">
              {rows.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-medium">{t.subject}</p>
                    <p className="text-[11px] text-muted">{t.dairyName || "—"} · {t.userName} · {t.priority} · {formatDate(t.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AdminStatus status={t.status} />
                    {(["open", "progress", "resolved", "closed"] as const).map((st) => (
                      <button key={st} type="button" className={btnGhost} onClick={() => void platformAct({ op: "ticketStatus", id: t.id, status: st }).then(() => reload())}>{st}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

export function NoticesAdmin() {
  const { t } = useI18n();
  const { data, loading, error, reload } = usePlatform<{ notices: PlatformNotice[] }>("notifications");
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">Alerts</p>
          <h1 className="font-display text-[26px] leading-none">{t("notifications")}</h1>
        </div>
        <button type="button" className={btnGhost} onClick={() => void platformAct({ op: "noticeRead", id: "", all: true }).then(() => reload())}>Mark all read</button>
      </div>
      {loading ? <LoadingState /> : error ? <p className="text-sm text-danger">{error}</p> : (
        <Panel title={t("inbox")}>
          {(data?.notices || []).length === 0 ? <EmptyState text="Koi notification nahi" /> : (
            <ul className="divide-y divide-line">
              {data?.notices.map((n) => (
                <li key={n.id} className={`px-4 py-3 text-sm ${n.readAt ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{n.title}</p>
                      <p className="text-muted">{n.body}</p>
                      <p className="text-[11px] text-muted">{n.kind} · {formatDate(n.createdAt)}</p>
                    </div>
                    {!n.readAt ? <button type="button" className={btnGhost} onClick={() => void platformAct({ op: "noticeRead", id: n.id }).then(() => reload())}>Read</button> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

export function AuditAdmin() {
  const { t } = useI18n();
  const [dairy, setDairy] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [moduleName, setModule] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const extra = `&dairy=${encodeURIComponent(dairy)}&actor=${encodeURIComponent(actor)}&action=${encodeURIComponent(action)}&module=${encodeURIComponent(moduleName)}&from=${from}&to=${to}`;
  const { data, loading, error } = usePlatform<{ logs: PlatformAudit[] }>("audit", extra);
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">Security</p>
        <h1 className="font-display text-[26px] leading-none">{t("auditLogs")}</h1>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input className={inputClass} placeholder="Dairy" value={dairy} onChange={(e) => setDairy(e.target.value)} />
        <input className={inputClass} placeholder="User / actor" value={actor} onChange={(e) => setActor(e.target.value)} />
        <input className={inputClass} placeholder="Action" value={action} onChange={(e) => setAction(e.target.value)} />
        <input className={inputClass} placeholder="Module" value={moduleName} onChange={(e) => setModule(e.target.value)} />
        <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {loading ? <LoadingState /> : error ? <p className="text-sm text-danger">{error}</p> : (
        <Panel title={`${data?.logs.length || 0} events`}>
          {(data?.logs || []).length === 0 ? <EmptyState text="Filters clear karke dekho" /> : (
            <div className="table-scroll">
              <table className="min-w-full text-left text-[12px]">
                <thead className="table-head text-muted">
                  <tr>{["Who", "Action", "Dairy", "Module", "When", "Old", "New"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data?.logs.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="px-3 py-2">{row.actor}</td>
                      <td className="px-3 py-2">{row.action}</td>
                      <td className="px-3 py-2">{row.dairyName || row.dairyId || "—"}</td>
                      <td className="px-3 py-2">{row.module}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                      <td className="px-3 py-2 max-w-[140px] truncate">{row.oldValue || "—"}</td>
                      <td className="px-3 py-2 max-w-[140px] truncate">{row.newValue || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

export function BackupAdmin() {
  const { t } = useI18n();
  const { data, loading, error, reload } = usePlatform<{ backups: PlatformBackupRow[]; health: PlatformHealth }>("backups");
  const { push } = useToast();
  async function exportNow() {
    try {
      const result = await platformAct({ op: "backup" }) as { filename: string; payload: string; bytes: number };
      const blob = new Blob([result.payload], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(a.href);
      push("Export download ho gaya");
      await reload();
    } catch (err) {
      push(err instanceof Error ? err.message : "Export fail", "err");
    }
  }
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">Data</p>
          <h1 className="font-display text-[26px] leading-none">{t("backup")}</h1>
        </div>
        <button type="button" className={btnPrimary} onClick={() => void exportNow()}>Safe export</button>
      </div>
      {loading ? <LoadingState /> : error ? <p className="text-sm text-danger">{error}</p> : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="text-[11px] text-muted">Last backup</p>
              <p className="font-display text-xl">{data?.health.lastBackup ? formatDate(data.health.lastBackup) : "—"}</p>
            </div>
            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="text-[11px] text-muted">Database</p>
              <p className="font-display text-xl capitalize">{data?.health.database}</p>
            </div>
          </div>
          <Panel title="History">
            {(data?.backups || []).length === 0 ? <EmptyState text="Pehla export yahin dikhega" /> : (
              <ul className="divide-y divide-line text-sm">
                {data?.backups.map((b) => (
                  <li key={b.id} className="flex justify-between px-4 py-2">
                    <span>{formatDate(b.createdAt)} · {b.note}</span>
                    <span>{b.bytes} B · {b.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

export function HealthAdmin() {
  const { t } = useI18n();
  const { data, loading, error } = usePlatform<PlatformHealth>("health");
  const items = data
    ? [
        ["API", data.api],
        ["Database", data.database],
        ["Authentication", data.auth],
        ["Storage", data.storage],
        ["Notification", data.notification],
        ["Backup", data.backup],
      ]
    : [];
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">Monitor</p>
        <h1 className="font-display text-[26px] leading-none">{t("systemHealth")}</h1>
      </div>
      {loading ? <LoadingState /> : error ? <p className="text-sm text-danger">{error}</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {items.map(([label, status]) => (
              <div key={label} className="rounded-2xl border border-line bg-card p-4">
                <p className="text-[11px] text-muted">{label}</p>
                <div className="mt-1"><AdminStatus status={String(status)} /></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-line bg-card p-4"><p className="text-[11px] text-muted">Errors</p><p className="font-display text-2xl">{data?.errorCount}</p></div>
            <div className="rounded-2xl border border-line bg-card p-4"><p className="text-[11px] text-muted">Active sessions</p><p className="font-display text-2xl">{data?.activeSessions}</p></div>
            <div className="rounded-2xl border border-line bg-card p-4"><p className="text-[11px] text-muted">API time</p><p className="font-display text-2xl">{data?.apiMs} ms</p></div>
          </div>
        </>
      )}
    </div>
  );
}

export function SettingsAdmin() {
  const { t } = useI18n();
  const { data, loading, error, reload } = usePlatform<{ settings: Record<string, string> }>("settings");
  const { push } = useToast();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [pass, setPass] = useState({ current: "", next: "", confirm: "" });
  const values = form || data?.settings || {};
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-primary uppercase">{t("config")}</p>
        <h1 className="font-display text-[26px] leading-none">{t("platformSettings")}</h1>
      </div>
      <Panel title={t("adminPassword")}>
        <div className="space-y-2 p-4">
          <label className="block">
            <span className="text-[11px] text-muted">{t("currentPassword")}</span>
            <input className={inputClass} type="password" value={pass.current} onChange={(e) => setPass((p) => ({ ...p, current: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted">{t("newPassword")}</span>
            <input className={inputClass} type="password" value={pass.next} onChange={(e) => setPass((p) => ({ ...p, next: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-[11px] text-muted">{t("confirmPassword")}</span>
            <input className={inputClass} type="password" value={pass.confirm} onChange={(e) => setPass((p) => ({ ...p, confirm: e.target.value }))} />
          </label>
          <button
            type="button"
            className={btnPrimary}
            disabled={!pass.current || !pass.next}
            onClick={() => {
              if (pass.next !== pass.confirm) {
                push(t("passwordMismatch"), "err");
                return;
              }
              void platformAct({ op: "changeAdminPassword", current: pass.current, next: pass.next })
                .then(() => {
                  push(t("passwordChanged"));
                  setPass({ current: "", next: "", confirm: "" });
                })
                .catch((err) => push(err instanceof Error ? err.message : "Fail", "err"));
            }}
          >
            {t("changePassword")}
          </button>
        </div>
      </Panel>
      {loading ? <LoadingState /> : error ? <p className="text-sm text-danger">{error}</p> : (
        <Panel title={t("brandingTrial")}>
          <div className="space-y-2 p-4">
            {["platformName", "supportEmail", "trialDays"].map((key) => (
              <label key={key} className="block">
                <span className="text-[11px] text-muted">{key}</span>
                <input className={inputClass} value={values[key] || ""} onChange={(e) => setForm({ ...values, [key]: e.target.value })} />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={values.maintenance === "1"} onChange={(e) => setForm({ ...values, maintenance: e.target.checked ? "1" : "0" })} />
              Maintenance mode
            </label>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => void platformAct({ op: "settings", settings: values }).then(() => { push("Settings saved"); setForm(null); void reload(); })}
            >
              Save
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}

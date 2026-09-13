"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { customerApi } from "@/lib/customers/client";
import { formatDate, formatTime } from "@/lib/dates";
import { formatInr, formatQty } from "@/lib/money";
import type { PlatformStats, PlatformStatus, PlatformUser } from "@/lib/platform/types";
import { btnDanger, btnGhost, btnPrimary, Card, PageHeader, confirmAction, inputClass } from "@/components/ui";

type Filter = "all" | "pending" | "active" | "cancelled";

function when(value: string | null) {
  if (!value) return "—";
  return `${formatDate(value)} ${formatTime(value)}`;
}

function StatusPill({ status }: { status: PlatformStatus }) {
  const label = status === "blocked" ? "cancelled" : status;
  const map = {
    pending: "bg-amber-50 text-amber-800",
    active: "bg-emerald-50 text-primary",
    blocked: "bg-red-50 text-danger",
    cancelled: "bg-red-50 text-danger",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${map[status]}`}>
      {label}
    </span>
  );
}

function dairyTitle(user: PlatformUser) {
  return user.dairyName || user.name || user.email || "Dairy";
}

export function AdminView() {
  const [stats, setStats] = useState<PlatformStats>({
    opened: 0,
    dairies: 0,
    pending: 0,
    active: 0,
    cancelled: 0,
    moneyIn: 0,
    collectionQty: 0,
  });
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const data = await customerApi<{ stats: PlatformStats; users: PlatformUser[] }>("/api/platform");
    setStats(data.stats);
    setUsers(data.users);
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Super admin data nahi mila"));
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      const cancelled = user.status === "cancelled" || user.status === "blocked";
      if (filter === "pending" && user.status !== "pending") return false;
      if (filter === "active" && user.status !== "active") return false;
      if (filter === "cancelled" && !cancelled) return false;
      if (!q) return true;
      return [user.name, user.email, user.username, user.password, user.dairyName, user.category, user.phone, user.dairyId]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [users, filter, query]);

  async function act(id: string, op: "verify" | "cancel" | "restore" | "delete") {
    if (op === "cancel" && !confirmAction("Is dairy ko cancel karna hai? Login band ho jayega.")) return;
    if (op === "delete" && !confirmAction("Is account ko delete karna hai? Wapas nahi aayega, phir naya signup kar sakte ho.")) return;
    setBusyId(id);
    setError("");
    try {
      await customerApi("/api/platform", { method: "POST", body: JSON.stringify({ op, id }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action fail");
    } finally {
      setBusyId("");
    }
  }

  const cards = [
    { label: "Log open kiye", value: String(stats.opened) },
    { label: "Active dairies", value: String(stats.active) },
    { label: "Pending verify", value: String(stats.pending) },
    { label: "Cancelled", value: String(stats.cancelled) },
    { label: "Paisa aaya", value: formatInr(stats.moneyIn) },
    { label: "Collection", value: formatQty(stats.collectionQty) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        kicker="Platform control"
        title="Dairies"
        hint="Sirf super admin panel. Har card usi dairy ka data hai — Tony Dairy dusri dairy ke saath mix nahi hota."
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.label} className="p-4">
            <p className="text-[11px] font-medium text-muted">{card.label}</p>
            <p className="mt-1 font-display text-[22px] leading-none break-words sm:text-[26px]">{card.value}</p>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          className={`${inputClass} sm:max-w-xs`}
          placeholder="Dairy, naam, email search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "active", "cancelled"] as Filter[]).map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? btnPrimary : btnGhost}
              onClick={() => setFilter(item)}
            >
              {item === "all" ? `Sab (${users.length})` : item}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-muted">
          Is filter mein koi dairy nahi. Signup ke baad har dairy alag card mein aayegi.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((user) => {
            const closed = user.status === "cancelled" || user.status === "blocked";
            const canManage = user.source === "signup";
            const open = openId === user.id;
            return (
              <Card key={user.id} className="overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 p-4 text-left"
                  onClick={() => setOpenId(open ? "" : user.id)}
                >
                  <div className="min-w-0">
                    <p className="font-display text-[20px] leading-tight">{dairyTitle(user)}</p>
                    <p className="mt-1 truncate text-[12px] text-muted">
                      {user.centerName || user.category || "Dairy"}
                      {user.source === "desk" ? " · Owner desk" : ""}
                    </p>
                  </div>
                  <StatusPill status={user.status} />
                </button>
                <div className="grid grid-cols-3 gap-2 border-t border-line px-4 py-3 text-[12px]">
                  <div>
                    <p className="text-muted">Farmers</p>
                    <p className="font-semibold">{user.farmers}</p>
                  </div>
                  <div>
                    <p className="text-muted">Customers</p>
                    <p className="font-semibold">{user.customers}</p>
                  </div>
                  <div>
                    <p className="text-muted">Collection</p>
                    <p className="font-semibold">{formatQty(user.collectionQty)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Paisa aaya</p>
                    <p className="font-semibold">{formatInr(user.moneyIn)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Milk amount</p>
                    <p className="font-semibold">{formatInr(user.collectionAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted">OTP</p>
                    <p className="font-mono font-semibold">{user.otpCode || "—"}</p>
                  </div>
                </div>
                {open ? (
                  <div className="space-y-3 border-t border-line bg-[#fbf7ef] px-4 py-3 text-[13px]">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p>
                        <span className="text-muted">Owner: </span>
                        {user.name || "—"}
                      </p>
                      <p>
                        <span className="text-muted">Email: </span>
                        {user.email || "desk account"}
                      </p>
                      <p>
                        <span className="text-muted">Username: </span>
                        <b>{user.username || user.email || "—"}</b>
                      </p>
                      <p>
                        <span className="text-muted">Password: </span>
                        <b className="font-mono">{user.password || "—"}</b>
                      </p>
                      <p>
                        <span className="text-muted">Phone: </span>
                        {user.phone || "—"}
                      </p>
                      <p>
                        <span className="text-muted">Category: </span>
                        {user.category || "—"}
                      </p>
                      <p>
                        <span className="text-muted">Last login: </span>
                        {when(user.lastLoginAt)}
                      </p>
                      <p>
                        <span className="text-muted">Opened: </span>
                        {when(user.createdAt)}
                      </p>
                    </div>
                    {canManage ? (
                      <div className="flex flex-wrap gap-1.5">
                        {user.status === "pending" ? (
                          <button
                            type="button"
                            className={btnGhost}
                            disabled={busyId === user.id}
                            onClick={() => void act(user.id, "verify")}
                          >
                            Verify
                          </button>
                        ) : null}
                        {closed ? (
                          <button
                            type="button"
                            className={btnGhost}
                            disabled={busyId === user.id}
                            onClick={() => void act(user.id, "restore")}
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={btnDanger}
                            disabled={busyId === user.id}
                            onClick={() => void act(user.id, "cancel")}
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          className={btnDanger}
                          disabled={busyId === user.id}
                          onClick={() => void act(user.id, "delete")}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted">
                        Owner desk — is dairy ka collection/farmers data sirf is card mein hai.
                        {user.username && user.password
                          ? ` Desk login: ${user.username} / ${user.password}`
                          : " Desk login Settings se set hai."}
                      </p>
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-[12px] text-muted">
        {stats.dairies} dairy desks · list mein {users.length} · dikh rahi {rows.length}
      </p>
    </div>
  );
}

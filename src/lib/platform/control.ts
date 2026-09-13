import { randomUUID } from "node:crypto";
import { CustomerError } from "@/lib/customers/errors";
import { isPostgres, postgresUrl, qall, qget, qrun } from "@/lib/customers/db";
import { DEFAULT_DAIRY_ID } from "@/lib/customers/context";
import { addDays, todayISO } from "@/lib/dates";
import type {
  ChartPoint,
  PlatformAudit,
  PlatformBackupRow,
  PlatformHealth,
  PlatformNotice,
  PlatformPaymentRow,
  PlatformPermission,
  PlatformPlan,
  PlatformStaff,
  PlatformSubscription,
  PlatformTicket,
  StaffRole,
  SubStatus,
  TicketPriority,
  TicketStatus,
} from "@/lib/platform/types";
import { PLATFORM_MODULES, STAFF_ROLES } from "@/lib/platform/types";
import { deletePlatformUser, listPlatformUsers, migrateSuperAdminPassword, wipeDairyRows } from "@/lib/platform/service";

function nowISO() {
  return new Date().toISOString();
}

function str(value: unknown) {
  return value == null ? "" : String(value);
}

function num(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") {
      const value = Number(row[key]);
      if (Number.isFinite(value)) return value;
    }
  }
  return 0;
}

function flag(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "t" || value === "true";
}

const PLANS: Array<Omit<PlatformPlan, "active"> & { active: number }> = [
  { id: "plan-basic", name: "Basic", priceMonthly: 499, userLimit: 2, customerLimit: 100, trialDays: 14, features: "Collection, farmers, slips", active: 1 },
  { id: "plan-business", name: "Business", priceMonthly: 1499, userLimit: 8, customerLimit: 500, trialDays: 14, features: "Customers, bills, reports", active: 1 },
  { id: "plan-enterprise", name: "Enterprise", priceMonthly: 4999, userLimit: 0, customerLimit: 0, trialDays: 21, features: "Unlimited + priority support", active: 1 },
];

let seeded = false;

export async function writeAudit(input: {
  actor: string;
  dairyId?: string;
  dairyName?: string;
  module: string;
  action: string;
  oldValue?: string;
  newValue?: string;
}) {
  await qrun(
    `INSERT INTO PlatformAudit (id, actor, dairyId, dairyName, module, action, oldValue, newValue, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(),
    input.actor || "admin",
    input.dairyId || "",
    input.dairyName || "",
    input.module,
    input.action,
    input.oldValue || "",
    input.newValue || "",
    nowISO(),
  );
}

async function pushNotice(kind: string, title: string, body: string, refId = "") {
  const exists = await qget(`SELECT id FROM PlatformNotice WHERE kind = ? AND refId = ?`, kind, refId);
  if (exists) return;
  await qrun(
    `INSERT INTO PlatformNotice (id, kind, title, body, refId, readAt, createdAt) VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    randomUUID(),
    kind,
    title,
    body,
    refId,
    nowISO(),
  );
}

export async function ensurePlatformControl() {
  if (seeded) return;
  await migrateSuperAdminPassword();
  const ready = await qget(`SELECT id FROM PlatformPlan LIMIT 1`);
  if (ready) {
    seeded = true;
    await assignMissingTrials();
    return;
  }
  for (const plan of PLANS) {
    await qrun(
      `INSERT OR IGNORE INTO PlatformPlan (id, name, priceMonthly, userLimit, customerLimit, trialDays, features, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      plan.id,
      plan.name,
      plan.priceMonthly,
      plan.userLimit,
      plan.customerLimit,
      plan.trialDays,
      plan.features,
      plan.active,
    );
  }
  await qrun(
    `INSERT OR IGNORE INTO PlatformCoupon (id, code, discount, kind, active, expiresAt, createdAt) VALUES (?, ?, ?, ?, 1, ?, ?)`,
    "coupon-welcome",
    "WELCOME20",
    20,
    "percent",
    addDays(todayISO(), 180),
    nowISO(),
  );
  for (const role of STAFF_ROLES) {
    for (const mod of PLATFORM_MODULES) {
      const allowed = role === "super_admin" || role === "dairy_owner" || (role === "manager" && mod !== "settings") || (role === "operator" && (mod === "collection" || mod === "farmers")) || (role === "delivery" && (mod === "customers" || mod === "payments"));
      await qrun(`INSERT OR IGNORE INTO PlatformPermission (role, module, allowed) VALUES (?, ?, ?)`, role, mod, allowed ? 1 : 0);
    }
  }
  const defaults: Record<string, string> = {
    platformName: "DudhSetu",
    supportEmail: "jitendrajangir788@gmail.com",
    trialDays: "14",
    maintenance: "0",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await qrun(`INSERT OR IGNORE INTO PlatformSetting (key, value) VALUES (?, ?)`, key, value);
  }
  seeded = true;
  await assignMissingTrials();
}

async function assignMissingTrials() {
  const plan = PLANS[0];
  const dairies = await qall(
    `SELECT d.id FROM Dairy d LEFT JOIN PlatformSubscription s ON s.dairyId = d.id WHERE s.id IS NULL`,
  );
  for (const dairy of dairies) {
    const dairyId = str(dairy.id);
    const expires = addDays(todayISO(), plan.trialDays);
    await qrun(
      `INSERT INTO PlatformSubscription (id, dairyId, planId, status, trialEndsAt, startsAt, expiresAt, couponCode, discount, createdAt, updatedAt)
       VALUES (?, ?, ?, 'trial', ?, ?, ?, '', 0, ?, ?)`,
      randomUUID(),
      dairyId,
      plan.id,
      expires,
      todayISO(),
      expires,
      nowISO(),
      nowISO(),
    );
    await qrun(`INSERT OR IGNORE INTO PlatformDairyMeta (dairyId, status, location) VALUES (?, 'active', '')`, dairyId);
  }
}

export async function syncNotices() {
  const pending = await qall(`SELECT id, dairyName, email FROM PlatformUser WHERE status = 'pending'`);
  for (const row of pending) {
    await pushNotice("pending_approval", "Pending dairy approval", `${str(row.dairyName) || str(row.email)} verify wait kar raha hai`, str(row.id));
  }
  const expiring = await qall(
    `SELECT s.id, s.dairyId, d.name AS dairyName, s.expiresAt FROM PlatformSubscription s
     LEFT JOIN Dairy d ON d.id = s.dairyId
     WHERE s.expiresAt IS NOT NULL AND s.expiresAt <= ? AND s.status IN ('trial','active','expiring')`,
    addDays(todayISO(), 7),
  );
  for (const row of expiring) {
    const expired = str(row.expiresAt) < todayISO();
    await pushNotice(
      expired ? "subscription_expired" : "subscription_expiry",
      expired ? "Subscription expired" : "Subscription expiring",
      `${str(row.dairyName) || str(row.dairyId)} · ${str(row.expiresAt).slice(0, 10)}`,
      str(row.id),
    );
    await qrun(`UPDATE PlatformSubscription SET status = ? WHERE id = ?`, expired ? "expired" : "expiring", str(row.id));
  }
}

function mapPlan(row: Record<string, unknown>): PlatformPlan {
  return {
    id: str(row.id),
    name: str(row.name),
    priceMonthly: num(row, "priceMonthly"),
    userLimit: num(row, "userLimit"),
    customerLimit: num(row, "customerLimit"),
    trialDays: num(row, "trialDays"),
    features: str(row.features),
    active: flag(row.active),
  };
}

function subStatus(row: Record<string, unknown>): SubStatus {
  const raw = str(row.status);
  if (raw === "cancelled" || raw === "expired" || raw === "trial" || raw === "expiring") return raw;
  const exp = str(row.expiresAt);
  if (exp && exp < todayISO()) return "expired";
  if (exp && exp <= addDays(todayISO(), 7)) return "expiring";
  return "active";
}

function mapSub(row: Record<string, unknown>): PlatformSubscription {
  return {
    id: str(row.id),
    dairyId: str(row.dairyId),
    dairyName: str(row.dairyName) || str(row.dairyId),
    planId: str(row.planId),
    planName: str(row.planName) || str(row.planId),
    priceMonthly: num(row, "priceMonthly"),
    userLimit: num(row, "userLimit"),
    customerLimit: num(row, "customerLimit"),
    status: subStatus(row),
    trialEndsAt: row.trialEndsAt ? str(row.trialEndsAt) : null,
    startsAt: str(row.startsAt),
    expiresAt: row.expiresAt ? str(row.expiresAt) : null,
    couponCode: str(row.couponCode),
    discount: num(row, "discount"),
  };
}

export async function controlDashboard() {
  await ensurePlatformControl();
  const today = todayISO();
  const userStats = await qget(
    `SELECT COUNT(*) AS opened,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
            COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
            COALESCE(SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END), 0) AS suspended,
            COALESCE(SUM(CASE WHEN status IN ('cancelled', 'blocked') THEN 1 ELSE 0 END), 0) AS cancelled
     FROM PlatformUser`,
  );
  const dairyCount = await qget(`SELECT COUNT(*) AS t FROM Dairy`);
  const farmers = await qget(`SELECT COUNT(*) AS t FROM Farmer`);
  const customers = await qget(`SELECT COUNT(*) AS t FROM Customer`);
  const todayMilk = await qget(`SELECT COALESCE(SUM(qty), 0) AS t FROM CollectionEntry WHERE date = ?`, today);
  const todayPay = await qget(`SELECT COALESCE(SUM(amount), 0) AS t FROM CustomerPayment WHERE date = ?`, today);
  const todayWalk = await qget(`SELECT COALESCE(SUM(paidAmount), 0) AS t FROM DailyMilkDelivery WHERE date = ?`, today);
  const pendingPay = await qget(`SELECT COALESCE(SUM(net), 0) AS t FROM FarmerBill WHERE status = 'open'`);
  const outstanding = await qget(`SELECT COALESCE(SUM(outstanding), 0) AS t FROM MonthlyBill`);
  const staff = await qget(`SELECT COUNT(*) AS t FROM PlatformStaff`);
  const pendingRows = await qall(
    `SELECT id, name, email, dairyName, createdAt, status FROM PlatformUser WHERE status = 'pending' ORDER BY createdAt DESC`,
  );
  const opened = num(userStats || {}, "opened");
  const active = num(userStats || {}, "active");
  const pending = num(userStats || {}, "pending");
  const suspended = num(userStats || {}, "suspended");
  const cancelled = num(userStats || {}, "cancelled");
  const dairies = Math.max(num(dairyCount || {}, "t"), opened);
  const from = addDays(today, -13);

  const regs = await qall(
    `SELECT substr(createdAt, 1, 10) AS label, COUNT(*) AS value FROM PlatformUser WHERE substr(createdAt,1,10) >= ? GROUP BY substr(createdAt,1,10) ORDER BY label`,
    from,
  );
  const milk = await qall(
    `SELECT date AS label, COALESCE(SUM(qty),0) AS value FROM CollectionEntry WHERE date >= ? GROUP BY date ORDER BY date`,
    from,
  );
  const revenue = await qall(
    `SELECT date AS label, COALESCE(SUM(amount),0) AS value FROM CustomerPayment WHERE date >= ? GROUP BY date ORDER BY date`,
    from,
  );
  const top = await qall(
    `SELECT e.dairyId, COALESCE(s.dairyName, d.name, e.dairyId) AS dairyName, COALESCE(SUM(e.qty),0) AS value
     FROM CollectionEntry e
     LEFT JOIN Dairy d ON d.id = e.dairyId
     LEFT JOIN DairySettings s ON s.dairyId = e.dairyId
     GROUP BY e.dairyId, s.dairyName, d.name
     ORDER BY value DESC
     LIMIT 10`,
  );
  const auditRows = await qall(`SELECT * FROM PlatformAudit ORDER BY createdAt DESC LIMIT 10`);
  const audit = auditRows.map((row) => ({
    id: str(row.id),
    actor: str(row.actor),
    action: str(row.action),
    dairyName: str(row.dairyName),
    createdAt: str(row.createdAt),
    module: str(row.module),
  }));
  const subs = await listSubscriptions();

  const fill = (rows: Record<string, unknown>[]): ChartPoint[] => {
    const map = new Map(rows.map((row) => [str(row.label), num(row, "value")]));
    const points: ChartPoint[] = [];
    for (let i = 13; i >= 0; i--) {
      const label = addDays(today, -i);
      points.push({ label: label.slice(5), value: map.get(label) || 0 });
    }
    return points;
  };

  return {
    kpis: {
      dairies,
      active,
      pending,
      suspended,
      totalUsers: opened + num(staff || {}, "t") + 1,
      totalFarmers: num(farmers || {}, "t"),
      totalCustomers: num(customers || {}, "t"),
      todayQty: num(todayMilk || {}, "t"),
      todayRevenue: num(todayPay || {}, "t") + num(todayWalk || {}, "t"),
      pendingPayments: num(pendingPay || {}, "t") + num(outstanding || {}, "t"),
    },
    charts: {
      registrations: fill(regs),
      milk: fill(milk),
      revenue: fill(revenue),
      status: [
        { label: "Active", value: active },
        { label: "Pending", value: pending },
        { label: "Suspended", value: suspended },
        { label: "Cancelled", value: cancelled },
      ],
      topDairies: top.map((row) => ({ label: str(row.dairyName) || str(row.dairyId), value: num(row, "value") })),
    },
    pending: pendingRows.slice(0, 8).map((row) => ({
      id: str(row.id),
      name: str(row.name),
      email: str(row.email),
      dairyName: str(row.dairyName),
      createdAt: str(row.createdAt),
    })),
    expiring: subs.filter((s) => s.status === "expiring" || s.status === "expired").slice(0, 8),
    activity: audit,
  };
}

export async function listPlans() {
  await ensurePlatformControl();
  return (await qall(`SELECT * FROM PlatformPlan ORDER BY priceMonthly`)).map(mapPlan);
}

export async function listSubscriptions() {
  await ensurePlatformControl();
  const rows = await qall(
    `SELECT s.*, p.name AS planName, p.priceMonthly, p.userLimit, p.customerLimit, COALESCE(ds.dairyName, d.name, s.dairyId) AS dairyName
     FROM PlatformSubscription s
     LEFT JOIN PlatformPlan p ON p.id = s.planId
     LEFT JOIN Dairy d ON d.id = s.dairyId
     LEFT JOIN DairySettings ds ON ds.dairyId = s.dairyId
     ORDER BY s.updatedAt DESC`,
  );
  return rows.map(mapSub);
}

export async function listPayments(): Promise<PlatformPaymentRow[]> {
  await ensurePlatformControl();
  const rows = await qall(
    `SELECT p.*, COALESCE(ds.dairyName, d.name, p.dairyId) AS dairyName
     FROM PlatformPayment p
     LEFT JOIN Dairy d ON d.id = p.dairyId
     LEFT JOIN DairySettings ds ON ds.dairyId = p.dairyId
     ORDER BY p.createdAt DESC`,
  );
  return rows.map((row) => ({
    id: str(row.id),
    dairyId: str(row.dairyId),
    dairyName: str(row.dairyName),
    amount: num(row, "amount"),
    method: str(row.method),
    status: str(row.status),
    note: str(row.note),
    createdAt: str(row.createdAt),
  }));
}

export async function assignPlan(dairyId: string, planId: string, couponCode = "", actor = "admin") {
  await ensurePlatformControl();
  const plan = await qget(`SELECT * FROM PlatformPlan WHERE id = ?`, planId);
  if (!plan) throw new CustomerError("Plan nahi mila");
  let discount = 0;
  if (couponCode) {
    const coupon = await qget(`SELECT * FROM PlatformCoupon WHERE code = ? AND active = 1`, couponCode.trim().toUpperCase());
    if (!coupon) throw new CustomerError("Coupon galat hai");
    discount = num(coupon, "discount");
  }
  const months = 1;
  const expires = addDays(todayISO(), 30 * months);
  const existing = await qget(`SELECT * FROM PlatformSubscription WHERE dairyId = ?`, dairyId);
  const amount = Math.max(0, num(plan, "priceMonthly") * (1 - discount / 100));
  if (existing) {
    await qrun(
      `UPDATE PlatformSubscription SET planId = ?, status = 'active', startsAt = ?, expiresAt = ?, couponCode = ?, discount = ?, updatedAt = ? WHERE dairyId = ?`,
      planId,
      todayISO(),
      expires,
      couponCode.trim().toUpperCase(),
      discount,
      nowISO(),
      dairyId,
    );
  } else {
    await qrun(
      `INSERT INTO PlatformSubscription (id, dairyId, planId, status, trialEndsAt, startsAt, expiresAt, couponCode, discount, createdAt, updatedAt)
       VALUES (?, ?, ?, 'active', NULL, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      dairyId,
      planId,
      todayISO(),
      expires,
      couponCode.trim().toUpperCase(),
      discount,
      nowISO(),
      nowISO(),
    );
  }
  const sub = await qget(`SELECT id FROM PlatformSubscription WHERE dairyId = ?`, dairyId);
  await qrun(
    `INSERT INTO PlatformPayment (id, dairyId, subscriptionId, amount, method, status, note, createdAt) VALUES (?, ?, ?, ?, 'manual', 'paid', ?, ?)`,
    randomUUID(),
    dairyId,
    str(sub?.id),
    amount,
    couponCode ? `Renew + ${couponCode}` : "Manual renewal",
    nowISO(),
  );
  await writeAudit({ actor, dairyId, module: "subscriptions", action: "assign_plan", newValue: `${planId} ${expires}` });
  return { ok: true };
}

export async function listStaff(): Promise<PlatformStaff[]> {
  await ensurePlatformControl();
  const rows = await qall(
    `SELECT st.*, COALESCE(ds.dairyName, d.name, st.dairyId) AS dairyName
     FROM PlatformStaff st
     LEFT JOIN Dairy d ON d.id = st.dairyId
     LEFT JOIN DairySettings ds ON ds.dairyId = st.dairyId
     ORDER BY st.createdAt DESC`,
  );
  return rows.map((row) => ({
    id: str(row.id),
    dairyId: str(row.dairyId),
    dairyName: str(row.dairyName),
    name: str(row.name),
    email: str(row.email),
    phone: str(row.phone),
    role: (str(row.role) || "operator") as StaffRole,
    status: str(row.status) === "inactive" ? "inactive" : "active",
    lastLoginAt: row.lastLoginAt ? str(row.lastLoginAt) : null,
    lastDevice: str(row.lastDevice) || "—",
    createdAt: str(row.createdAt),
  }));
}

export async function saveStaff(input: { id?: string; dairyId: string; name: string; email: string; phone: string; role: string; status?: string }, actor = "admin") {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const dairyId = input.dairyId.trim();
  if (name.length < 2) throw new CustomerError("Naam likho");
  if (!dairyId) throw new CustomerError("Dairy choose karo");
  if (!STAFF_ROLES.includes(input.role as StaffRole) || input.role === "super_admin") {
    throw new CustomerError("Role galat hai");
  }
  const status = input.status === "inactive" ? "inactive" : "active";
  if (input.id) {
    await qrun(
      `UPDATE PlatformStaff SET dairyId = ?, name = ?, email = ?, phone = ?, role = ?, status = ? WHERE id = ?`,
      dairyId,
      name,
      email,
      input.phone.trim(),
      input.role,
      status,
      input.id,
    );
    await writeAudit({ actor, dairyId, module: "users", action: "staff_update", newValue: `${name} ${input.role}` });
    return { id: input.id };
  }
  const id = randomUUID();
  await qrun(
    `INSERT INTO PlatformStaff (id, dairyId, name, email, phone, role, status, lastLoginAt, lastDevice, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'Web', ?)`,
    id,
    dairyId,
    name,
    email,
    input.phone.trim(),
    input.role,
    status,
    nowISO(),
  );
  await writeAudit({ actor, dairyId, module: "users", action: "staff_create", newValue: `${name} ${input.role}` });
  return { id };
}

export async function deleteStaff(id: string, actor = "admin") {
  const row = await qget(`SELECT * FROM PlatformStaff WHERE id = ?`, id);
  if (!row) throw new CustomerError("Staff nahi mila", 404);
  await qrun(`DELETE FROM PlatformStaff WHERE id = ?`, id);
  await writeAudit({ actor, dairyId: str(row.dairyId), module: "users", action: "staff_delete", oldValue: str(row.name) });
  return { ok: true };
}

export async function listPermissions(): Promise<PlatformPermission[]> {
  await ensurePlatformControl();
  const rows = await qall(`SELECT * FROM PlatformPermission`);
  return rows.map((row) => ({
    role: str(row.role) as StaffRole,
    module: str(row.module),
    allowed: flag(row.allowed),
  }));
}

export async function savePermission(role: string, module: string, allowed: boolean, actor = "admin") {
  await qrun(
    `INSERT OR IGNORE INTO PlatformPermission (role, module, allowed) VALUES (?, ?, ?)`,
    role,
    module,
    allowed ? 1 : 0,
  );
  await qrun(`UPDATE PlatformPermission SET allowed = ? WHERE role = ? AND module = ?`, allowed ? 1 : 0, role, module);
  await writeAudit({ actor, module: "users", action: "permission", newValue: `${role} ${module} ${allowed}` });
  return { ok: true };
}

export async function listAudit(filter: { dairy?: string; actor?: string; action?: string; module?: string; from?: string; to?: string }): Promise<PlatformAudit[]> {
  await ensurePlatformControl();
  const rows = await qall(`SELECT * FROM PlatformAudit ORDER BY createdAt DESC`);
  return rows
    .map((row) => ({
      id: str(row.id),
      actor: str(row.actor),
      dairyId: str(row.dairyId),
      dairyName: str(row.dairyName),
      module: str(row.module),
      action: str(row.action),
      oldValue: str(row.oldValue),
      newValue: str(row.newValue),
      createdAt: str(row.createdAt),
    }))
    .filter((row) => {
      if (filter.dairy && !`${row.dairyId} ${row.dairyName}`.toLowerCase().includes(filter.dairy.toLowerCase())) return false;
      if (filter.actor && !row.actor.toLowerCase().includes(filter.actor.toLowerCase())) return false;
      if (filter.action && row.action !== filter.action) return false;
      if (filter.module && row.module !== filter.module) return false;
      const day = row.createdAt.slice(0, 10);
      if (filter.from && day < filter.from) return false;
      if (filter.to && day > filter.to) return false;
      return true;
    });
}

export async function listTickets(): Promise<PlatformTicket[]> {
  await ensurePlatformControl();
  const rows = await qall(`SELECT * FROM PlatformTicket ORDER BY updatedAt DESC`);
  return rows.map((row) => ({
    id: str(row.id),
    dairyId: str(row.dairyId),
    dairyName: str(row.dairyName),
    userName: str(row.userName),
    subject: str(row.subject),
    priority: (str(row.priority) || "medium") as TicketPriority,
    status: (str(row.status) || "open") as TicketStatus,
    message: str(row.message),
    createdAt: str(row.createdAt),
    updatedAt: str(row.updatedAt),
  }));
}

export async function saveTicket(input: { id?: string; dairyId?: string; dairyName?: string; userName: string; subject: string; priority: string; message: string }, actor = "admin") {
  if (!input.subject.trim()) throw new CustomerError("Subject likho");
  const now = nowISO();
  if (input.id) {
    await qrun(
      `UPDATE PlatformTicket SET dairyId = ?, dairyName = ?, userName = ?, subject = ?, priority = ?, message = ?, updatedAt = ? WHERE id = ?`,
      input.dairyId || "",
      input.dairyName || "",
      input.userName.trim() || "Owner",
      input.subject.trim(),
      input.priority || "medium",
      input.message.trim(),
      now,
      input.id,
    );
    await writeAudit({ actor, dairyId: input.dairyId, dairyName: input.dairyName, module: "support", action: "ticket_update", newValue: input.subject });
    return { id: input.id };
  }
  const id = randomUUID();
  await qrun(
    `INSERT INTO PlatformTicket (id, dairyId, dairyName, userName, subject, priority, status, message, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
    id,
    input.dairyId || "",
    input.dairyName || "",
    input.userName.trim() || "Owner",
    input.subject.trim(),
    input.priority || "medium",
    input.message.trim(),
    now,
    now,
  );
  await writeAudit({ actor, dairyId: input.dairyId, dairyName: input.dairyName, module: "support", action: "ticket_create", newValue: input.subject });
  return { id };
}

export async function setTicketStatus(id: string, status: TicketStatus, actor = "admin") {
  const row = await qget(`SELECT * FROM PlatformTicket WHERE id = ?`, id);
  if (!row) throw new CustomerError("Ticket nahi mila", 404);
  await qrun(`UPDATE PlatformTicket SET status = ?, updatedAt = ? WHERE id = ?`, status, nowISO(), id);
  await writeAudit({ actor, dairyId: str(row.dairyId), module: "support", action: "ticket_status", oldValue: str(row.status), newValue: status });
  return { ok: true };
}

export async function listNotices(): Promise<PlatformNotice[]> {
  await ensurePlatformControl();
  const rows = await qall(`SELECT * FROM PlatformNotice ORDER BY createdAt DESC`);
  return rows.map((row) => ({
    id: str(row.id),
    kind: str(row.kind),
    title: str(row.title),
    body: str(row.body),
    refId: str(row.refId),
    readAt: row.readAt ? str(row.readAt) : null,
    createdAt: str(row.createdAt),
  }));
}

export async function markNotice(id: string, all = false) {
  if (all) await qrun(`UPDATE PlatformNotice SET readAt = ? WHERE readAt IS NULL`, nowISO());
  else await qrun(`UPDATE PlatformNotice SET readAt = ? WHERE id = ?`, nowISO(), id);
  return { ok: true };
}

export async function listBackups(): Promise<PlatformBackupRow[]> {
  await ensurePlatformControl();
  const rows = await qall(`SELECT * FROM PlatformBackup ORDER BY createdAt DESC`);
  return rows.map((row) => ({
    id: str(row.id),
    status: str(row.status),
    bytes: num(row, "bytes"),
    note: str(row.note),
    createdAt: str(row.createdAt),
  }));
}

export async function createBackup(actor = "admin") {
  await ensurePlatformControl();
  const users = await listPlatformUsers();
  const payload = JSON.stringify({
    exportedAt: nowISO(),
    dairies: users.map((u) => ({
      id: u.id,
      dairyId: u.dairyId,
      dairyName: u.dairyName,
      email: u.email,
      status: u.status,
      farmers: u.farmers,
      customers: u.customers,
      collectionQty: u.collectionQty,
      moneyIn: u.moneyIn,
    })),
  });
  const id = randomUUID();
  await qrun(
    `INSERT INTO PlatformBackup (id, status, bytes, note, createdAt) VALUES (?, 'ok', ?, 'Platform dairy export', ?)`,
    id,
    payload.length,
    nowISO(),
  );
  await writeAudit({ actor, module: "backup", action: "export", newValue: id });
  return { id, createdAt: nowISO(), bytes: payload.length, filename: `dudhsetu-dairies-${todayISO()}.json`, payload };
}

export async function platformHealth(): Promise<PlatformHealth> {
  const started = Date.now();
  let database: PlatformHealth["database"] = "ok";
  try {
    await qget(`SELECT 1 AS ok`);
  } catch {
    database = "down";
  }
  const last = await qget(`SELECT createdAt FROM PlatformBackup ORDER BY createdAt DESC`);
  const errors = await qget(`SELECT COUNT(*) AS t FROM PlatformAudit WHERE action LIKE '%fail%' OR action LIKE '%error%'`);
  const unread = await qget(`SELECT COUNT(*) AS t FROM PlatformNotice WHERE readAt IS NULL`);
  const mail = Boolean(process.env.RESEND_API_KEY || process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS);
  return {
    api: "ok",
    database,
    auth: "ok",
    storage: isPostgres() || postgresUrl() ? "ok" : "warn",
    notification: mail ? "ok" : "warn",
    backup: last ? "ok" : "warn",
    errorCount: num(errors || {}, "t"),
    activeSessions: 1,
    apiMs: Date.now() - started,
    lastBackup: last ? str(last.createdAt) : null,
  };
}

export async function getSettings() {
  await ensurePlatformControl();
  const rows = await qall(`SELECT key, value FROM PlatformSetting`);
  return Object.fromEntries(rows.map((row) => [str(row.key), str(row.value)]));
}

export async function saveSettings(values: Record<string, string>, actor = "admin") {
  for (const [key, value] of Object.entries(values)) {
    await qrun(`INSERT OR IGNORE INTO PlatformSetting (key, value) VALUES (?, ?)`, key, value);
    await qrun(`UPDATE PlatformSetting SET value = ? WHERE key = ?`, value, key);
  }
  await writeAudit({ actor, module: "settings", action: "update", newValue: Object.keys(values).join(",") });
  return getSettings();
}

export async function editDairy(
  id: string,
  input: { dairyName?: string; name?: string; phone?: string; address?: string; category?: string; planId?: string },
  actor = "admin",
) {
  const users = await listPlatformUsers();
  const user = users.find((item) => item.id === id);
  if (!user) throw new CustomerError("Dairy nahi mili", 404);
  if (user.source === "signup") {
    await qrun(
      `UPDATE PlatformUser SET name = COALESCE(NULLIF(?, ''), name), dairyName = COALESCE(NULLIF(?, ''), dairyName), category = COALESCE(NULLIF(?, ''), category) WHERE id = ?`,
      input.name || "",
      input.dairyName || "",
      input.category || "",
      id,
    );
  }
  if (user.dairyId) {
    const settings = await qget(`SELECT * FROM DairySettings WHERE dairyId = ?`, user.dairyId);
    if (settings) {
      await qrun(
        `UPDATE DairySettings SET dairyName = COALESCE(NULLIF(?, ''), dairyName), phone = COALESCE(NULLIF(?, ''), phone), address = COALESCE(NULLIF(?, ''), address), updatedAt = ? WHERE dairyId = ?`,
        input.dairyName || "",
        input.phone || "",
        input.address || "",
        nowISO(),
        user.dairyId,
      );
    }
    if (input.dairyName) {
      await qrun(`UPDATE Dairy SET name = ? WHERE id = ?`, input.dairyName, user.dairyId);
    }
    if (input.planId) await assignPlan(user.dairyId, input.planId, "", actor);
    await qrun(`INSERT OR IGNORE INTO PlatformDairyMeta (dairyId, status, location) VALUES (?, 'active', ?)`, user.dairyId, input.address || "");
    if (input.address) await qrun(`UPDATE PlatformDairyMeta SET location = ? WHERE dairyId = ?`, input.address, user.dairyId);
  }
  await writeAudit({
    actor,
    dairyId: user.dairyId || "",
    dairyName: input.dairyName || user.dairyName,
    module: "dairies",
    action: "edit",
    oldValue: user.dairyName,
    newValue: input.dairyName || user.dairyName,
  });
  return { ok: true };
}

export async function setDeskStatus(id: string, status: "active" | "blocked" | "cancelled", actor = "admin") {
  const users = await listPlatformUsers();
  const user = users.find((item) => item.id === id);
  if (!user?.dairyId) throw new CustomerError("Dairy nahi mili", 404);
  if (user.dairyId === DEFAULT_DAIRY_ID && status !== "active") {
    throw new CustomerError("Owner desk ko suspend/cancel nahi kar sakte");
  }
  await qrun(`INSERT OR IGNORE INTO PlatformDairyMeta (dairyId, status, location) VALUES (?, ?, '')`, user.dairyId, status);
  await qrun(`UPDATE PlatformDairyMeta SET status = ? WHERE dairyId = ?`, status, user.dairyId);
  await writeAudit({ actor, dairyId: user.dairyId, dairyName: user.dairyName, module: "dairies", action: status, oldValue: user.status, newValue: status });
  return { ok: true };
}

export async function impersonatePayload(id: string, actor = "admin") {
  const users = await listPlatformUsers();
  const user = users.find((item) => item.id === id);
  if (!user?.dairyId) throw new CustomerError("Is dairy ka desk abhi ready nahi");
  if (user.status === "cancelled") throw new CustomerError("Cancelled dairy mein login nahi");
  await writeAudit({
    actor,
    dairyId: user.dairyId,
    dairyName: user.dairyName,
    module: "dairies",
    action: "impersonate",
    newValue: user.username || user.email,
  });
  return {
    dairyId: user.dairyId,
    username: user.username || user.email || "owner",
    email: user.email,
    name: user.name || user.dairyName,
    dairyName: user.dairyName,
    role: "dairy_owner" as const,
  };
}

export async function findDairyRecord(id: string) {
  if (id.startsWith("desk:")) {
    const dairyId = id.slice(5);
    const row = await qget(`SELECT id, name FROM Dairy WHERE id = ?`, dairyId);
    if (!row) return null;
    return { id, source: "desk" as const, dairyId, dairyName: str(row.name), status: "active" };
  }
  const row = await qget(`SELECT * FROM PlatformUser WHERE id = ?`, id);
  if (!row) return null;
  return {
    id,
    source: "signup" as const,
    dairyId: row.dairyId ? str(row.dairyId) : "",
    dairyName: str(row.dairyName),
    status: str(row.status),
  };
}

export async function deleteAnyDairy(id: string, actor = "admin") {
  if (id.startsWith("desk:")) {
    const dairyId = id.slice(5);
    const row = await qget(`SELECT name FROM Dairy WHERE id = ?`, dairyId);
    if (!row) throw new CustomerError("Dairy nahi mili", 404);
    await wipeDairyRows(dairyId);
    await writeAudit({ actor, dairyId, dairyName: str(row.name), module: "dairies", action: "delete", oldValue: id });
    return { ok: true };
  }
  const row = await qget(`SELECT * FROM PlatformUser WHERE id = ?`, id);
  if (!row) throw new CustomerError("Dairy nahi mili", 404);
  if (str(row.dairyId) === DEFAULT_DAIRY_ID) throw new CustomerError("Tony Dairy delete nahi hoti");
  await deletePlatformUser(id);
  await writeAudit({ actor, dairyId: str(row.dairyId), dairyName: str(row.dairyName), module: "dairies", action: "delete", oldValue: id });
  return { ok: true };
}

export async function analyticsRange(from: string, to: string) {
  await ensurePlatformControl();
  from = from || addDays(todayISO(), -30);
  to = to || todayISO();
  const milk = await qall(
    `SELECT date AS label, COALESCE(SUM(qty),0) AS value FROM CollectionEntry WHERE date >= ? AND date <= ? GROUP BY date ORDER BY date`,
    from,
    to,
  );
  const revenue = await qall(
    `SELECT date AS label, COALESCE(SUM(amount),0) AS value FROM CustomerPayment WHERE date >= ? AND date <= ? GROUP BY date ORDER BY date`,
    from,
    to,
  );
  const regs = await qall(
    `SELECT substr(createdAt,1,10) AS label, COUNT(*) AS value FROM PlatformUser WHERE substr(createdAt,1,10) >= ? AND substr(createdAt,1,10) <= ? GROUP BY substr(createdAt,1,10) ORDER BY label`,
    from,
    to,
  );
  return {
    milk: milk.map((row) => ({ label: str(row.label), value: num(row, "value") })),
    revenue: revenue.map((row) => ({ label: str(row.label), value: num(row, "value") })),
    registrations: regs.map((row) => ({ label: str(row.label), value: num(row, "value") })),
  };
}

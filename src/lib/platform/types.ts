export const DAIRY_CATEGORIES = [
  "Collection centre",
  "Milk society",
  "Private dairy",
  "Farm / gaushala",
  "Distributor",
  "Other",
] as const;

export type DairyCategory = (typeof DAIRY_CATEGORIES)[number];
export type PlatformRole = "platform_admin" | "dairy_owner";
export type StaffRole = "super_admin" | "dairy_owner" | "manager" | "operator" | "delivery";
export type PlatformStatus = "pending" | "active" | "blocked" | "cancelled";
export type SubStatus = "trial" | "active" | "expiring" | "expired" | "cancelled";
export type TicketStatus = "open" | "progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type PlatformUser = {
  id: string;
  email: string;
  username: string;
  password: string;
  name: string;
  role: PlatformRole;
  status: PlatformStatus;
  category: string;
  dairyId: string | null;
  dairyName: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  otpCode: string | null;
  otpExpiresAt: string | null;
  phone: string;
  centerName: string;
  farmers: number;
  customers: number;
  collectionQty: number;
  collectionAmount: number;
  moneyIn: number;
  source: "signup" | "desk";
  location: string;
  planId: string;
  planName: string;
  planStatus: string;
  planExpiresAt: string | null;
  todayQty: number;
  staffCount: number;
  usersCount: number;
  lastDevice: string;
};

export type PlatformStats = {
  opened: number;
  dairies: number;
  pending: number;
  active: number;
  cancelled: number;
  moneyIn: number;
  collectionQty: number;
  suspended?: number;
  totalUsers?: number;
  totalFarmers?: number;
  totalCustomers?: number;
  todayQty?: number;
  todayRevenue?: number;
  pendingPayments?: number;
};

export type ChartPoint = { label: string; value: number };

export type PlatformPlan = {
  id: string;
  name: string;
  priceMonthly: number;
  userLimit: number;
  customerLimit: number;
  trialDays: number;
  features: string;
  active: boolean;
};

export type PlatformSubscription = {
  id: string;
  dairyId: string;
  dairyName: string;
  planId: string;
  planName: string;
  priceMonthly: number;
  userLimit: number;
  customerLimit: number;
  status: SubStatus;
  trialEndsAt: string | null;
  startsAt: string;
  expiresAt: string | null;
  couponCode: string;
  discount: number;
};

export type PlatformPaymentRow = {
  id: string;
  dairyId: string;
  dairyName: string;
  amount: number;
  method: string;
  status: string;
  note: string;
  createdAt: string;
};

export type PlatformStaff = {
  id: string;
  dairyId: string;
  dairyName: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  status: "active" | "inactive";
  lastLoginAt: string | null;
  lastDevice: string;
  createdAt: string;
};

export type PlatformPermission = {
  role: StaffRole;
  module: string;
  allowed: boolean;
};

export type PlatformAudit = {
  id: string;
  actor: string;
  dairyId: string;
  dairyName: string;
  module: string;
  action: string;
  oldValue: string;
  newValue: string;
  createdAt: string;
};

export type PlatformTicket = {
  id: string;
  dairyId: string;
  dairyName: string;
  userName: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformNotice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  refId: string;
  readAt: string | null;
  createdAt: string;
};

export type PlatformBackupRow = {
  id: string;
  status: string;
  bytes: number;
  note: string;
  createdAt: string;
};

export type PlatformHealth = {
  api: "ok" | "down";
  database: "ok" | "down";
  auth: "ok" | "down";
  storage: "ok" | "warn";
  notification: "ok" | "warn";
  backup: "ok" | "warn";
  errorCount: number;
  activeSessions: number;
  apiMs: number;
  lastBackup: string | null;
};

export const PLATFORM_MODULES = [
  "collection",
  "farmers",
  "customers",
  "payments",
  "expenses",
  "rate-charts",
  "reports",
  "settings",
] as const;

export const STAFF_ROLES: StaffRole[] = ["super_admin", "dairy_owner", "manager", "operator", "delivery"];

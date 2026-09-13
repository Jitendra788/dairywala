import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { DEFAULT_DAIRY_ID, DEFAULT_DAIRY_NAME } from "@/lib/customers/context";

type StatementSync = {
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Record<string, unknown>[];
};

type DatabaseSync = {
  exec: (sql: string) => void;
  prepare: (sql: string) => StatementSync;
  close: () => void;
};

const CAMEL_FIELDS = [
  "dairyId",
  "customerCode",
  "customerId",
  "customerType",
  "milkType",
  "defaultQty",
  "defaultRate",
  "createdAt",
  "updatedAt",
  "dailyQty",
  "startDate",
  "deliveryTime",
  "paymentCycle",
  "pauseFrom",
  "resumeDate",
  "regularQty",
  "extraQty",
  "deliveredQty",
  "skipReason",
  "paymentStatus",
  "paymentMode",
  "paidAmount",
  "deliveryId",
  "remainingBalance",
  "totalDelivered",
  "totalAmount",
  "skippedDays",
  "extraMilk",
  "rowMilkType",
  "salePaymentStatus",
  "walkInQty",
  "walkInSales",
  "regularSales",
  "customerMilkType",
  "customerStatus",
  "farmerId",
  "billId",
  "fromDate",
  "toDate",
  "avgFat",
  "avgSnf",
  "paidAt",
  "dairyName",
  "centerName",
  "profileComplete",
  "rateMethod",
  "cowMethod",
  "buffaloMethod",
  "bankName",
  "accountNo",
  "passwordHash",
  "isDefault",
  "fatCoeff",
  "snfCoeff",
  "fatRate",
  "kgFatRate",
  "efuRate",
  "snfEfuFactor",
  "goodSnfMin",
  "fatMin",
  "fatMax",
  "fatStep",
  "snfMin",
  "snfMax",
  "snfStep",
  "spentBy",
  "deletedAt",
  "passwordHash",
  "emailVerifiedAt",
  "lastLoginAt",
  "dairyName",
  "codeHash",
  "expiresAt",
  "collectionQty",
  "collectionAmount",
  "customerPaid",
  "walkInPaid",
  "farmers",
  "customers",
  "otpCode",
  "otpExpiresAt",
  "passwordPlain",
  "planId",
  "planName",
  "planStatus",
  "planExpiresAt",
  "userLimit",
  "customerLimit",
  "trialDays",
  "priceMonthly",
  "todayQty",
  "staffCount",
  "lastDevice",
  "oldValue",
  "newValue",
  "lastUpdate",
  "readAt",
  "refId",
  "couponCode",
  "dairyName",
  "userName",
  "startsAt",
  "trialEndsAt",
];

const SCHEMA_VERSION = 8;

const globalForDb = globalThis as unknown as {
  tonyCustomerDb?: DatabaseSync;
  tonyNeonSql?: NeonQueryFunction<false, false>;
  tonyDbReady?: Promise<void>;
  tonySchemaVersion?: number;
  tonyDbMode?: string;
};

export function postgresUrl() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || "";
}

export function isPostgres() {
  return Boolean(postgresUrl());
}

function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function loadSqlite() {
  const getBuiltin = process.getBuiltinModule?.bind(process);
  if (!getBuiltin) {
    throw new Error("SQLite is not available on this Node runtime");
  }
  const sqlite = getBuiltin("node:sqlite") as { DatabaseSync?: new (location: string) => DatabaseSync } | undefined;
  if (!sqlite?.DatabaseSync) {
    throw new Error("node:sqlite is not available on this host");
  }
  return sqlite.DatabaseSync;
}

function dbFile() {
  const dir = isServerless() ? os.tmpdir() : path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "tony-dairy.db");
}

function normalizeRow(row: Record<string, unknown> | undefined) {
  if (!row) return undefined;
  const lower = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  const next = { ...row };
  for (const field of CAMEL_FIELDS) {
    const value = lower[field.toLowerCase()];
    if (value !== undefined) next[field] = value;
  }
  return next;
}

function adaptSql(sql: string) {
  let next = sql.trim();
  next = next.replace(/\bIFNULL\s*\(/gi, "COALESCE(");
  next = next.replace(
    /substr\s*\(\s*replace\s*\(\s*mobile\s*,\s*' '\s*,\s*''\s*\)\s*,\s*-10\s*\)/gi,
    "RIGHT(REPLACE(mobile, ' ', ''), 10)",
  );
  if (/^INSERT\s+OR\s+IGNORE\s+INTO/i.test(next)) {
    next = next.replace(/^INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO").replace(/;?\s*$/, " ON CONFLICT DO NOTHING");
  }
  let index = 0;
  next = next.replace(/\?/g, () => `$${++index}`);
  return next;
}

function neonSql() {
  if (!globalForDb.tonyNeonSql) {
    globalForDb.tonyNeonSql = neon(postgresUrl());
  }
  return globalForDb.tonyNeonSql;
}

async function pgQuery(sql: string, params: unknown[] = []) {
  const rows = (await neonSql().query(adaptSql(sql), params)) as Record<string, unknown>[];
  return rows.map((row) => normalizeRow(row)!);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS Dairy (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Customer (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  customerCode TEXT NOT NULL,
  name TEXT NOT NULL,
  mobile TEXT,
  address TEXT NOT NULL,
  milkType TEXT NOT NULL,
  customerType TEXT NOT NULL DEFAULT 'regular',
  defaultQty DOUBLE PRECISION NOT NULL DEFAULT 0,
  defaultRate DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE (dairyId, customerCode),
  UNIQUE (dairyId, mobile)
);
CREATE TABLE IF NOT EXISTS CustomerSubscription (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  customerId TEXT NOT NULL UNIQUE,
  dailyQty DOUBLE PRECISION NOT NULL,
  rate DOUBLE PRECISION NOT NULL,
  startDate TEXT NOT NULL,
  deliveryTime TEXT NOT NULL,
  paymentCycle TEXT NOT NULL,
  pauseFrom TEXT,
  resumeDate TEXT,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS DailyMilkDelivery (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  customerId TEXT NOT NULL,
  date TEXT NOT NULL,
  regularQty DOUBLE PRECISION NOT NULL,
  extraQty DOUBLE PRECISION NOT NULL,
  deliveredQty DOUBLE PRECISION NOT NULL,
  rate DOUBLE PRECISION NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  skipReason TEXT,
  notes TEXT,
  milkType TEXT,
  source TEXT NOT NULL DEFAULT 'subscription',
  paymentStatus TEXT,
  paymentMode TEXT,
  paidAmount DOUBLE PRECISION NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE (dairyId, customerId, date)
);
CREATE TABLE IF NOT EXISTS MilkLedger (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  customerId TEXT NOT NULL,
  date TEXT NOT NULL,
  regularQty DOUBLE PRECISION NOT NULL,
  extraQty DOUBLE PRECISION NOT NULL,
  deliveredQty DOUBLE PRECISION NOT NULL,
  rate DOUBLE PRECISION NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  deliveryId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE (dairyId, deliveryId)
);
CREATE TABLE IF NOT EXISTS CustomerPayment (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  customerId TEXT NOT NULL,
  date TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  mode TEXT NOT NULL,
  reference TEXT,
  remainingBalance DOUBLE PRECISION NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS MonthlyBill (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  customerId TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  totalDelivered DOUBLE PRECISION NOT NULL,
  totalAmount DOUBLE PRECISION NOT NULL,
  skippedDays INTEGER NOT NULL,
  extraMilk DOUBLE PRECISION NOT NULL,
  paidAmount DOUBLE PRECISION NOT NULL,
  outstanding DOUBLE PRECISION NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE (dairyId, customerId, year, month)
);
CREATE INDEX IF NOT EXISTS idx_customer_dairy_status ON Customer(dairyId, status);
CREATE INDEX IF NOT EXISTS idx_delivery_dairy_date ON DailyMilkDelivery(dairyId, date);
CREATE INDEX IF NOT EXISTS idx_ledger_dairy_date ON MilkLedger(dairyId, date);
CREATE INDEX IF NOT EXISTS idx_payment_dairy_customer ON CustomerPayment(dairyId, customerId);
CREATE INDEX IF NOT EXISTS idx_customer_dairy_type ON Customer(dairyId, customerType);
CREATE INDEX IF NOT EXISTS idx_delivery_dairy_source ON DailyMilkDelivery(dairyId, source, date);
CREATE TABLE IF NOT EXISTS DairySettings (
  dairyId TEXT PRIMARY KEY,
  dairyName TEXT NOT NULL,
  centerName TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  logo TEXT NOT NULL,
  profileComplete INTEGER NOT NULL DEFAULT 1,
  rateMethod TEXT NOT NULL,
  cowMethod TEXT NOT NULL,
  buffaloMethod TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Farmer (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  milkType TEXT NOT NULL,
  bankName TEXT NOT NULL,
  accountNo TEXT NOT NULL,
  ifsc TEXT NOT NULL,
  upi TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE (dairyId, code)
);
CREATE TABLE IF NOT EXISTS CollectionEntry (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  farmerId TEXT NOT NULL,
  date TEXT NOT NULL,
  shift TEXT NOT NULL,
  milkType TEXT NOT NULL,
  qty DOUBLE PRECISION NOT NULL,
  fat DOUBLE PRECISION NOT NULL,
  snf DOUBLE PRECISION NOT NULL,
  clr DOUBLE PRECISION NOT NULL,
  rate DOUBLE PRECISION NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  billId TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS RateChart (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  milkType TEXT NOT NULL,
  fatCoeff DOUBLE PRECISION NOT NULL,
  snfCoeff DOUBLE PRECISION NOT NULL,
  base DOUBLE PRECISION NOT NULL,
  fatRate DOUBLE PRECISION NOT NULL,
  kgFatRate DOUBLE PRECISION NOT NULL,
  efuRate DOUBLE PRECISION NOT NULL,
  snfEfuFactor DOUBLE PRECISION NOT NULL,
  goodSnfMin DOUBLE PRECISION NOT NULL,
  fatMin DOUBLE PRECISION NOT NULL,
  fatMax DOUBLE PRECISION NOT NULL,
  fatStep DOUBLE PRECISION NOT NULL,
  snfMin DOUBLE PRECISION NOT NULL,
  snfMax DOUBLE PRECISION NOT NULL,
  snfStep DOUBLE PRECISION NOT NULL,
  cells TEXT NOT NULL,
  rules TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS FarmerAdvance (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  farmerId TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  note TEXT NOT NULL,
  date TEXT NOT NULL,
  recovered INTEGER NOT NULL DEFAULT 0,
  billId TEXT
);
CREATE TABLE IF NOT EXISTS FarmerBill (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  farmerId TEXT NOT NULL,
  fromDate TEXT NOT NULL,
  toDate TEXT NOT NULL,
  qty DOUBLE PRECISION NOT NULL,
  avgFat DOUBLE PRECISION NOT NULL,
  avgSnf DOUBLE PRECISION NOT NULL,
  gross DOUBLE PRECISION NOT NULL,
  advance DOUBLE PRECISION NOT NULL,
  net DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  paidAt TEXT
);
CREATE TABLE IF NOT EXISTS DairyAuth (
  dairyId TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  isDefault INTEGER NOT NULL DEFAULT 1,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Expense (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  spentBy TEXT NOT NULL,
  remark TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  deletedAt TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformUser (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  category TEXT NOT NULL,
  dairyId TEXT,
  dairyName TEXT NOT NULL,
  emailVerifiedAt TEXT,
  lastLoginAt TEXT,
  passwordPlain TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS EmailVerify (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  codeHash TEXT NOT NULL,
  otpCode TEXT,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformPlan (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  priceMonthly DOUBLE PRECISION NOT NULL,
  userLimit INTEGER NOT NULL,
  customerLimit INTEGER NOT NULL,
  trialDays INTEGER NOT NULL,
  features TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS PlatformSubscription (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL UNIQUE,
  planId TEXT NOT NULL,
  status TEXT NOT NULL,
  trialEndsAt TEXT,
  startsAt TEXT NOT NULL,
  expiresAt TEXT,
  couponCode TEXT,
  discount DOUBLE PRECISION NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformPayment (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  subscriptionId TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformCoupon (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount DOUBLE PRECISION NOT NULL,
  kind TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  expiresAt TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformStaff (
  id TEXT PRIMARY KEY,
  dairyId TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  lastLoginAt TEXT,
  lastDevice TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformPermission (
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (role, module)
);
CREATE TABLE IF NOT EXISTS PlatformAudit (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  dairyId TEXT,
  dairyName TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  oldValue TEXT,
  newValue TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformTicket (
  id TEXT PRIMARY KEY,
  dairyId TEXT,
  dairyName TEXT,
  userName TEXT NOT NULL,
  subject TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformNotice (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  refId TEXT,
  readAt TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformBackup (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformSetting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PlatformDairyMeta (
  dairyId TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  location TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_farmer_dairy_code ON Farmer(dairyId, code);
CREATE INDEX IF NOT EXISTS idx_expense_dairy_date ON Expense(dairyId, date);
CREATE INDEX IF NOT EXISTS idx_collection_dairy_date ON CollectionEntry(dairyId, date);
CREATE INDEX IF NOT EXISTS idx_collection_farmer ON CollectionEntry(dairyId, farmerId);
CREATE INDEX IF NOT EXISTS idx_advance_farmer ON FarmerAdvance(dairyId, farmerId);
CREATE INDEX IF NOT EXISTS idx_bill_farmer ON FarmerBill(dairyId, farmerId);
`;

async function migratePostgres() {
  const statements = SCHEMA.split(";").map((part) => part.trim()).filter(Boolean);
  for (const statement of statements) {
    await neonSql().query(statement);
  }
  const now = new Date().toISOString();
  await pgQuery(`INSERT OR IGNORE INTO Dairy (id, name, createdAt) VALUES (?, ?, ?)`, [
    DEFAULT_DAIRY_ID,
    DEFAULT_DAIRY_NAME,
    now,
  ]);
  try {
    await neonSql().query(`ALTER TABLE EmailVerify ADD COLUMN IF NOT EXISTS otpCode TEXT`);
  } catch {
    // already exists
  }
  try {
    await neonSql().query(`ALTER TABLE PlatformUser ADD COLUMN IF NOT EXISTS passwordPlain TEXT`);
  } catch {
    // already exists
  }
  try {
    await neonSql().query(`ALTER TABLE PlatformUser ADD COLUMN IF NOT EXISTS lastDevice TEXT`);
  } catch {
    // already exists
  }
}

function ensureColumn(db: DatabaseSync, table: string, column: string, def: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  } catch {
    // already exists
  }
}

function migrateSqlite(db: DatabaseSync) {
  const journal = isServerless() ? "DELETE" : "WAL";
  db.exec(`PRAGMA journal_mode = ${journal}; PRAGMA foreign_keys = ON;`);
  db.exec(SCHEMA.replace(/DOUBLE PRECISION/g, "REAL"));
  ensureColumn(db, "Customer", "customerType", "TEXT NOT NULL DEFAULT 'regular'");
  ensureColumn(db, "Customer", "defaultQty", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "Customer", "defaultRate", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "DailyMilkDelivery", "milkType", "TEXT");
  ensureColumn(db, "DailyMilkDelivery", "source", "TEXT NOT NULL DEFAULT 'subscription'");
  ensureColumn(db, "DailyMilkDelivery", "paymentStatus", "TEXT");
  ensureColumn(db, "DailyMilkDelivery", "paymentMode", "TEXT");
  ensureColumn(db, "DailyMilkDelivery", "paidAmount", "REAL NOT NULL DEFAULT 0");
  const now = new Date().toISOString();
  ensureColumn(db, "EmailVerify", "otpCode", "TEXT");
  ensureColumn(db, "PlatformUser", "passwordPlain", "TEXT");
  ensureColumn(db, "PlatformUser", "lastDevice", "TEXT");
  db.prepare(`INSERT OR IGNORE INTO Dairy (id, name, createdAt) VALUES (?, ?, ?)`).run(
    DEFAULT_DAIRY_ID,
    DEFAULT_DAIRY_NAME,
    now,
  );
}

function sqliteDb() {
  if (globalForDb.tonyCustomerDb) return globalForDb.tonyCustomerDb;
  const DatabaseSync = loadSqlite();
  const db = new DatabaseSync(dbFile());
  migrateSqlite(db);
  globalForDb.tonyCustomerDb = db;
  return db;
}

export async function ensureDb() {
  const mode = isPostgres() ? "pg" : "sqlite";
  if (globalForDb.tonySchemaVersion !== SCHEMA_VERSION || globalForDb.tonyDbMode !== mode) {
    globalForDb.tonyDbReady = undefined;
    globalForDb.tonySchemaVersion = SCHEMA_VERSION;
    globalForDb.tonyDbMode = mode;
  }
  if (globalForDb.tonyDbReady) return globalForDb.tonyDbReady;
  globalForDb.tonyDbReady = (async () => {
    if (isPostgres()) await migratePostgres();
    else {
      const db = sqliteDb();
      migrateSqlite(db);
    }
  })();
  return globalForDb.tonyDbReady;
}

export async function qget(sql: string, ...params: unknown[]) {
  await ensureDb();
  if (isPostgres()) {
    const rows = await pgQuery(sql, params);
    return rows[0];
  }
  return normalizeRow(sqliteDb().prepare(sql).get(...params));
}

export async function qall(sql: string, ...params: unknown[]) {
  await ensureDb();
  if (isPostgres()) return pgQuery(sql, params);
  return sqliteDb().prepare(sql).all(...params).map((row) => normalizeRow(row)!);
}

export async function qrun(sql: string, ...params: unknown[]) {
  await ensureDb();
  if (isPostgres()) {
    await pgQuery(sql, params);
    return { changes: 1 };
  }
  return sqliteDb().prepare(sql).run(...params);
}

export async function assertDairy(dairyId: string) {
  const row = await qget(`SELECT id FROM Dairy WHERE id = ?`, dairyId);
  if (!row) {
    const now = new Date().toISOString();
    await qrun(`INSERT OR IGNORE INTO Dairy (id, name, createdAt) VALUES (?, ?, ?)`, dairyId, dairyId, now);
  }
}

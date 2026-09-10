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
];

const globalForDb = globalThis as unknown as {
  tonyCustomerDb?: DatabaseSync;
  tonyNeonSql?: NeonQueryFunction<false, false>;
  tonyDbReady?: Promise<void>;
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
  if (globalForDb.tonyDbReady) return globalForDb.tonyDbReady;
  globalForDb.tonyDbReady = (async () => {
    if (isPostgres()) await migratePostgres();
    else sqliteDb();
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

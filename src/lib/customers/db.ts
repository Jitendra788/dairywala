import fs from "node:fs";
import path from "node:path";
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

const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as {
  DatabaseSync: new (location: string) => DatabaseSync;
};

const globalForDb = globalThis as unknown as { tonyCustomerDb?: DatabaseSync };

function dbFile() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "tony-dairy.db");
}

function migrate(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

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
      mobile TEXT NOT NULL,
      address TEXT NOT NULL,
      milkType TEXT NOT NULL,
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
      dailyQty REAL NOT NULL,
      rate REAL NOT NULL,
      startDate TEXT NOT NULL,
      deliveryTime TEXT NOT NULL,
      paymentCycle TEXT NOT NULL,
      pauseFrom TEXT,
      resumeDate TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES Customer(id)
    );

    CREATE TABLE IF NOT EXISTS DailyMilkDelivery (
      id TEXT PRIMARY KEY,
      dairyId TEXT NOT NULL,
      customerId TEXT NOT NULL,
      date TEXT NOT NULL,
      regularQty REAL NOT NULL,
      extraQty REAL NOT NULL,
      deliveredQty REAL NOT NULL,
      rate REAL NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      skipReason TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE (dairyId, customerId, date),
      FOREIGN KEY (customerId) REFERENCES Customer(id)
    );

    CREATE TABLE IF NOT EXISTS MilkLedger (
      id TEXT PRIMARY KEY,
      dairyId TEXT NOT NULL,
      customerId TEXT NOT NULL,
      date TEXT NOT NULL,
      regularQty REAL NOT NULL,
      extraQty REAL NOT NULL,
      deliveredQty REAL NOT NULL,
      rate REAL NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      deliveryId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE (dairyId, deliveryId),
      FOREIGN KEY (customerId) REFERENCES Customer(id)
    );

    CREATE TABLE IF NOT EXISTS CustomerPayment (
      id TEXT PRIMARY KEY,
      dairyId TEXT NOT NULL,
      customerId TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      mode TEXT NOT NULL,
      reference TEXT,
      remainingBalance REAL NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES Customer(id)
    );

    CREATE TABLE IF NOT EXISTS MonthlyBill (
      id TEXT PRIMARY KEY,
      dairyId TEXT NOT NULL,
      customerId TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      totalDelivered REAL NOT NULL,
      totalAmount REAL NOT NULL,
      skippedDays INTEGER NOT NULL,
      extraMilk REAL NOT NULL,
      paidAmount REAL NOT NULL,
      outstanding REAL NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE (dairyId, customerId, year, month),
      FOREIGN KEY (customerId) REFERENCES Customer(id)
    );

    CREATE INDEX IF NOT EXISTS idx_customer_dairy_status ON Customer(dairyId, status);
    CREATE INDEX IF NOT EXISTS idx_delivery_dairy_date ON DailyMilkDelivery(dairyId, date);
    CREATE INDEX IF NOT EXISTS idx_ledger_dairy_date ON MilkLedger(dairyId, date);
    CREATE INDEX IF NOT EXISTS idx_payment_dairy_customer ON CustomerPayment(dairyId, customerId);
  `);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO Dairy (id, name, createdAt) VALUES (?, ?, ?)`,
  ).run(DEFAULT_DAIRY_ID, DEFAULT_DAIRY_NAME, now);
}

export function getDb() {
  if (!globalForDb.tonyCustomerDb) {
    const db = new DatabaseSync(dbFile());
    migrate(db);
    globalForDb.tonyCustomerDb = db;
  }
  return globalForDb.tonyCustomerDb;
}

export function assertDairy(dairyId: string) {
  const row = getDb().prepare(`SELECT id FROM Dairy WHERE id = ?`).get(dairyId);
  if (!row) {
    const now = new Date().toISOString();
    getDb()
      .prepare(`INSERT INTO Dairy (id, name, createdAt) VALUES (?, ?, ?)`)
      .run(dairyId, dairyId, now);
  }
}

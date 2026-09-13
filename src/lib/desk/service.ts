import { CustomerError } from "@/lib/customers/errors";
import { assertDairy, qall, qget, qrun } from "@/lib/customers/db";
import { calcAmount, ensureMethodCharts, methodForMilk, normalizeChart, pickChart, quoteRate } from "@/lib/rate";
import { round2 } from "@/lib/money";
import { DEFAULT_DAIRY_LOGO } from "@/lib/profile";
import { defaultCharts, defaultSettings } from "@/lib/desk/defaults";
import type {
  Advance,
  Bill,
  CollectionEntry,
  DairyState,
  Farmer,
  MilkType,
  RateChart,
  Settings,
  Shift,
} from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown) {
  return value == null ? "" : String(value);
}

function flag(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "t" || value === "true";
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw == null ? fallback : (raw as T);
}

function mapSettings(row: Record<string, unknown> | undefined): Settings {
  const fallback = defaultSettings();
  if (!row) return fallback;
  return {
    dairyName: str(row.dairyName) || fallback.dairyName,
    centerName: str(row.centerName),
    phone: str(row.phone),
    address: str(row.address),
    logo: str(row.logo) || DEFAULT_DAIRY_LOGO,
    profileComplete: row.profileComplete == null ? true : flag(row.profileComplete),
    rateMethod: (str(row.rateMethod) || fallback.rateMethod) as Settings["rateMethod"],
    cowMethod: (str(row.cowMethod) || fallback.cowMethod) as Settings["cowMethod"],
    buffaloMethod: (str(row.buffaloMethod) || fallback.buffaloMethod) as Settings["buffaloMethod"],
  };
}

function mapFarmer(row: Record<string, unknown>): Farmer {
  return {
    id: str(row.id),
    code: str(row.code),
    name: str(row.name),
    phone: str(row.phone),
    milkType: str(row.milkType) as Farmer["milkType"],
    bankName: str(row.bankName),
    accountNo: str(row.accountNo),
    ifsc: str(row.ifsc),
    upi: str(row.upi),
    createdAt: str(row.createdAt),
  };
}

function mapEntry(row: Record<string, unknown>): CollectionEntry {
  return {
    id: str(row.id),
    farmerId: str(row.farmerId),
    date: str(row.date),
    shift: str(row.shift) as Shift,
    milkType: str(row.milkType) as MilkType,
    qty: num(row.qty),
    fat: num(row.fat),
    snf: num(row.snf),
    clr: num(row.clr),
    rate: num(row.rate),
    amount: num(row.amount),
    billId: row.billId == null || row.billId === "" ? null : str(row.billId),
    createdAt: str(row.createdAt),
  };
}

function mapChart(row: Record<string, unknown>): RateChart {
  return normalizeChart({
    id: str(row.id),
    name: str(row.name),
    kind: str(row.kind) as RateChart["kind"],
    milkType: str(row.milkType) as RateChart["milkType"],
    fatCoeff: num(row.fatCoeff),
    snfCoeff: num(row.snfCoeff),
    base: num(row.base),
    fatRate: num(row.fatRate),
    kgFatRate: num(row.kgFatRate),
    efuRate: num(row.efuRate),
    snfEfuFactor: num(row.snfEfuFactor),
    goodSnfMin: num(row.goodSnfMin),
    fatMin: num(row.fatMin),
    fatMax: num(row.fatMax),
    fatStep: num(row.fatStep),
    snfMin: num(row.snfMin),
    snfMax: num(row.snfMax),
    snfStep: num(row.snfStep),
    cells: parseJson(row.cells, []),
    rules: parseJson(row.rules, []),
    active: flag(row.active),
  });
}

function mapAdvance(row: Record<string, unknown>): Advance {
  return {
    id: str(row.id),
    farmerId: str(row.farmerId),
    amount: num(row.amount),
    note: str(row.note),
    date: str(row.date),
    recovered: flag(row.recovered),
    billId: row.billId == null || row.billId === "" ? null : str(row.billId),
  };
}

function mapBill(row: Record<string, unknown>): Bill {
  return {
    id: str(row.id),
    farmerId: str(row.farmerId),
    fromDate: str(row.fromDate),
    toDate: str(row.toDate),
    qty: num(row.qty),
    avgFat: num(row.avgFat),
    avgSnf: num(row.avgSnf),
    gross: num(row.gross),
    advance: num(row.advance),
    net: num(row.net),
    status: str(row.status) as Bill["status"],
    createdAt: str(row.createdAt),
    paidAt: row.paidAt == null || row.paidAt === "" ? null : str(row.paidAt),
  };
}

async function insertSettings(dairyId: string, settings: Settings) {
  const now = new Date().toISOString();
  await qrun(
    `INSERT INTO DairySettings
      (dairyId, dairyName, centerName, phone, address, logo, profileComplete, rateMethod, cowMethod, buffaloMethod, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    dairyId,
    settings.dairyName,
    settings.centerName,
    settings.phone,
    settings.address,
    settings.logo || DEFAULT_DAIRY_LOGO,
    settings.profileComplete ? 1 : 0,
    settings.rateMethod,
    settings.cowMethod,
    settings.buffaloMethod,
    now,
  );
}

function chartRowId(dairyId: string, id: string) {
  if (id === "chart-cow" || id === "chart-buffalo") return `${dairyId}-${id}`;
  return id;
}

async function insertChart(dairyId: string, chart: RateChart) {
  await qrun(
    `INSERT OR IGNORE INTO RateChart
      (id, dairyId, name, kind, milkType, fatCoeff, snfCoeff, base, fatRate, kgFatRate, efuRate, snfEfuFactor,
       goodSnfMin, fatMin, fatMax, fatStep, snfMin, snfMax, snfStep, cells, rules, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    chartRowId(dairyId, chart.id),
    dairyId,
    chart.name,
    chart.kind,
    chart.milkType,
    chart.fatCoeff,
    chart.snfCoeff,
    chart.base,
    chart.fatRate,
    chart.kgFatRate,
    chart.efuRate,
    chart.snfEfuFactor,
    chart.goodSnfMin,
    chart.fatMin,
    chart.fatMax,
    chart.fatStep,
    chart.snfMin,
    chart.snfMax,
    chart.snfStep,
    JSON.stringify(chart.cells ?? []),
    JSON.stringify(chart.rules ?? []),
    chart.active ? 1 : 0,
  );
}

export async function ensureDesk(dairyId: string) {
  await assertDairy(dairyId);
  const settings = await qget(`SELECT * FROM DairySettings WHERE dairyId = ?`, dairyId);
  if (!settings) await insertSettings(dairyId, defaultSettings());
  const charts = await qall(`SELECT id FROM RateChart WHERE dairyId = ?`, dairyId);
  if (!charts.length) {
    for (const chart of defaultCharts()) await insertChart(dairyId, chart);
  }
}

export async function loadDesk(dairyId: string): Promise<DairyState> {
  await ensureDesk(dairyId);
  const [settingsRow, farmerRows, entryRows, chartRows, advanceRows, billRows] = await Promise.all([
    qget(`SELECT * FROM DairySettings WHERE dairyId = ?`, dairyId),
    qall(`SELECT * FROM Farmer WHERE dairyId = ? ORDER BY code`, dairyId),
    qall(`SELECT * FROM CollectionEntry WHERE dairyId = ? ORDER BY createdAt DESC`, dairyId),
    qall(`SELECT * FROM RateChart WHERE dairyId = ?`, dairyId),
    qall(`SELECT * FROM FarmerAdvance WHERE dairyId = ? ORDER BY date DESC`, dairyId),
    qall(`SELECT * FROM FarmerBill WHERE dairyId = ? ORDER BY createdAt DESC`, dairyId),
  ]);
  return {
    settings: mapSettings(settingsRow),
    farmers: farmerRows.map(mapFarmer),
    entries: entryRows.map(mapEntry),
    charts: ensureMethodCharts(chartRows.map(mapChart)),
    advances: advanceRows.map(mapAdvance),
    bills: billRows.map(mapBill),
  };
}

async function farmerByCode(dairyId: string, code: string) {
  return qget(`SELECT * FROM Farmer WHERE dairyId = ? AND code = ?`, dairyId, code.trim());
}

async function pricedRate(dairyId: string, milkType: MilkType, fat: number, snf: number) {
  const settings = mapSettings(await qget(`SELECT * FROM DairySettings WHERE dairyId = ?`, dairyId));
  const charts = ensureMethodCharts((await qall(`SELECT * FROM RateChart WHERE dairyId = ?`, dairyId)).map(mapChart));
  const method = methodForMilk(settings, milkType);
  const chart = pickChart(charts, milkType, method);
  return quoteRate(chart, fat, snf).rate;
}

export async function addFarmer(dairyId: string, input: Omit<Farmer, "id" | "createdAt">) {
  if (await farmerByCode(dairyId, input.code)) throw new CustomerError("Farmer code already exists");
  const phone = input.phone.replace(/\D/g, "").slice(-10);
  if (phone.length === 10) {
    const samePhone = await qget(
      `SELECT id FROM Farmer WHERE dairyId = ? AND REPLACE(phone, ' ', '') LIKE ?`,
      dairyId,
      `%${phone}`,
    );
    if (samePhone) throw new CustomerError("Is phone pe farmer pehle se hai");
  }
  const farmer: Farmer = {
    ...input,
    id: uid("f"),
    createdAt: new Date().toISOString(),
  };
  await qrun(
    `INSERT INTO Farmer (id, dairyId, code, name, phone, milkType, bankName, accountNo, ifsc, upi, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    farmer.id,
    dairyId,
    farmer.code,
    farmer.name,
    farmer.phone,
    farmer.milkType,
    farmer.bankName,
    farmer.accountNo,
    farmer.ifsc,
    farmer.upi,
    farmer.createdAt,
  );
  return farmer;
}

export async function updateFarmer(dairyId: string, id: string, patch: Partial<Farmer>) {
  const existing = await qget(`SELECT * FROM Farmer WHERE dairyId = ? AND id = ?`, dairyId, id);
  if (!existing) throw new CustomerError("Farmer nahi mili");
  if (patch.code) {
    const clash = await qget(`SELECT id FROM Farmer WHERE dairyId = ? AND code = ? AND id != ?`, dairyId, patch.code, id);
    if (clash) throw new CustomerError("Farmer code already exists");
  }
  const phone = (patch.phone ?? "").replace(/\D/g, "").slice(-10);
  if (phone.length === 10) {
    const samePhone = await qget(
      `SELECT id FROM Farmer WHERE dairyId = ? AND id != ? AND REPLACE(phone, ' ', '') LIKE ?`,
      dairyId,
      id,
      `%${phone}`,
    );
    if (samePhone) throw new CustomerError("Is phone pe farmer pehle se hai");
  }
  const next = { ...mapFarmer(existing), ...patch };
  await qrun(
    `UPDATE Farmer SET code = ?, name = ?, phone = ?, milkType = ?, bankName = ?, accountNo = ?, ifsc = ?, upi = ?
     WHERE dairyId = ? AND id = ?`,
    next.code,
    next.name,
    next.phone,
    next.milkType,
    next.bankName,
    next.accountNo,
    next.ifsc,
    next.upi,
    dairyId,
    id,
  );
}

export async function deleteFarmer(dairyId: string, id: string) {
  const billed = await qget(
    `SELECT id FROM CollectionEntry WHERE dairyId = ? AND farmerId = ? AND billId IS NOT NULL AND billId != ''`,
    dairyId,
    id,
  );
  if (billed) throw new CustomerError("Billed slips wali farmer delete nahi ho sakti");
  await qrun(`DELETE FROM CollectionEntry WHERE dairyId = ? AND farmerId = ?`, dairyId, id);
  await qrun(`DELETE FROM FarmerAdvance WHERE dairyId = ? AND farmerId = ?`, dairyId, id);
  await qrun(`DELETE FROM FarmerBill WHERE dairyId = ? AND farmerId = ?`, dairyId, id);
  await qrun(`DELETE FROM Farmer WHERE dairyId = ? AND id = ?`, dairyId, id);
}

export async function addCollection(
  dairyId: string,
  input: {
    farmerId: string;
    date: string;
    shift: Shift;
    milkType: MilkType;
    qty: number;
    fat: number;
    snf: number;
    clr: number;
  },
) {
  const farmer = await qget(`SELECT id FROM Farmer WHERE dairyId = ? AND id = ?`, dairyId, input.farmerId);
  if (!farmer) throw new CustomerError("Farmer nahi mili");
  const rate = await pricedRate(dairyId, input.milkType, input.fat, input.snf);
  const entry: CollectionEntry = {
    id: uid("col"),
    farmerId: input.farmerId,
    date: input.date,
    shift: input.shift,
    milkType: input.milkType,
    qty: input.qty,
    fat: input.fat,
    snf: input.snf,
    clr: input.clr,
    rate,
    amount: calcAmount(input.qty, rate),
    billId: null,
    createdAt: new Date().toISOString(),
  };
  await qrun(
    `INSERT INTO CollectionEntry
      (id, dairyId, farmerId, date, shift, milkType, qty, fat, snf, clr, rate, amount, billId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    dairyId,
    entry.farmerId,
    entry.date,
    entry.shift,
    entry.milkType,
    entry.qty,
    entry.fat,
    entry.snf,
    entry.clr,
    entry.rate,
    entry.amount,
    null,
    entry.createdAt,
  );
  return entry;
}

export async function updateCollection(
  dairyId: string,
  id: string,
  input: {
    farmerId: string;
    date: string;
    shift: Shift;
    milkType: MilkType;
    qty: number;
    fat: number;
    snf: number;
    clr: number;
  },
) {
  const existing = await qget(`SELECT * FROM CollectionEntry WHERE dairyId = ? AND id = ?`, dairyId, id);
  if (!existing) throw new CustomerError("Slip nahi mili");
  if (existing.billId) throw new CustomerError("Billed slip edit nahi ho sakti");
  const rate = await pricedRate(dairyId, input.milkType, input.fat, input.snf);
  await qrun(
    `UPDATE CollectionEntry
     SET farmerId = ?, date = ?, shift = ?, milkType = ?, qty = ?, fat = ?, snf = ?, clr = ?, rate = ?, amount = ?
     WHERE dairyId = ? AND id = ?`,
    input.farmerId,
    input.date,
    input.shift,
    input.milkType,
    input.qty,
    input.fat,
    input.snf,
    input.clr,
    rate,
    calcAmount(input.qty, rate),
    dairyId,
    id,
  );
}

export async function deleteCollection(dairyId: string, id: string) {
  const entry = await qget(`SELECT * FROM CollectionEntry WHERE dairyId = ? AND id = ?`, dairyId, id);
  if (entry?.billId) throw new CustomerError("Billed slip delete nahi ho sakti");
  await qrun(`DELETE FROM CollectionEntry WHERE dairyId = ? AND id = ?`, dairyId, id);
}

export async function saveCharts(dairyId: string, charts: RateChart[]) {
  const next = ensureMethodCharts(charts);
  await qrun(`DELETE FROM RateChart WHERE dairyId = ?`, dairyId);
  for (const chart of next) await insertChart(dairyId, chart);
}

export async function addChart(dairyId: string, input: Omit<RateChart, "id" | "cells">) {
  const chart = normalizeChart({ ...input, id: uid("chart"), cells: [] });
  await insertChart(dairyId, chart);
  return chart;
}

export async function deleteChart(dairyId: string, id: string) {
  const count = (await qall(`SELECT id FROM RateChart WHERE dairyId = ?`, dairyId)).length;
  if (count <= 1) throw new CustomerError("Kam se kam ek rate chart chahiye");
  await qrun(`DELETE FROM RateChart WHERE dairyId = ? AND id = ?`, dairyId, id);
}

export async function addAdvance(dairyId: string, input: { farmerId: string; amount: number; note: string; date: string }) {
  const advance: Advance = {
    id: uid("adv"),
    farmerId: input.farmerId,
    amount: input.amount,
    note: input.note,
    date: input.date,
    recovered: false,
    billId: null,
  };
  await qrun(
    `INSERT INTO FarmerAdvance (id, dairyId, farmerId, amount, note, date, recovered, billId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    advance.id,
    dairyId,
    advance.farmerId,
    advance.amount,
    advance.note,
    advance.date,
    0,
    null,
  );
  return advance;
}

export async function updateAdvance(
  dairyId: string,
  id: string,
  input: { farmerId: string; amount: number; note: string; date: string },
) {
  const existing = await qget(`SELECT * FROM FarmerAdvance WHERE dairyId = ? AND id = ?`, dairyId, id);
  if (!existing) throw new CustomerError("Advance nahi mila");
  if (flag(existing.recovered)) throw new CustomerError("Recovered advance edit nahi ho sakta");
  await qrun(
    `UPDATE FarmerAdvance SET farmerId = ?, amount = ?, note = ?, date = ? WHERE dairyId = ? AND id = ?`,
    input.farmerId,
    input.amount,
    input.note,
    input.date,
    dairyId,
    id,
  );
}

export async function deleteAdvance(dairyId: string, id: string) {
  const existing = await qget(`SELECT * FROM FarmerAdvance WHERE dairyId = ? AND id = ?`, dairyId, id);
  if (flag(existing?.recovered)) throw new CustomerError("Recovered advance delete nahi ho sakta");
  await qrun(`DELETE FROM FarmerAdvance WHERE dairyId = ? AND id = ?`, dairyId, id);
}

export async function deleteBill(dairyId: string, id: string) {
  const bill = await qget(`SELECT * FROM FarmerBill WHERE dairyId = ? AND id = ?`, dairyId, id);
  if (!bill) throw new CustomerError("Bill nahi mili");
  if (str(bill.status) === "paid") throw new CustomerError("Paid bill delete nahi ho sakti");
  await qrun(
    `UPDATE CollectionEntry SET billId = NULL WHERE dairyId = ? AND billId = ?`,
    dairyId,
    id,
  );
  await qrun(
    `UPDATE FarmerAdvance SET recovered = 0, billId = NULL WHERE dairyId = ? AND billId = ?`,
    dairyId,
    id,
  );
  await qrun(`DELETE FROM FarmerBill WHERE dairyId = ? AND id = ?`, dairyId, id);
}

export async function generateBills(dairyId: string, fromDate: string, toDate: string) {
  const open = (await qall(
    `SELECT * FROM CollectionEntry WHERE dairyId = ? AND date >= ? AND date <= ? AND (billId IS NULL OR billId = '')`,
    dairyId,
    fromDate,
    toDate,
  )).map(mapEntry);
  const byFarmer = new Map<string, CollectionEntry[]>();
  for (const entry of open) {
    const list = byFarmer.get(entry.farmerId) ?? [];
    list.push(entry);
    byFarmer.set(entry.farmerId, list);
  }
  const newBills: Bill[] = [];
  for (const [farmerId, list] of byFarmer) {
    const qty = list.reduce((s, e) => s + e.qty, 0);
    const gross = round2(list.reduce((s, e) => s + e.amount, 0));
    const avgFat = qty ? round2(list.reduce((s, e) => s + e.fat * e.qty, 0) / qty) : 0;
    const avgSnf = qty ? round2(list.reduce((s, e) => s + e.snf * e.qty, 0) / qty) : 0;
    const pending = (await qall(
      `SELECT * FROM FarmerAdvance WHERE dairyId = ? AND farmerId = ? AND recovered = 0`,
      dairyId,
      farmerId,
    )).map(mapAdvance);
    let remaining = gross;
    let advance = 0;
    const billId = uid("bill");
    const recovered: string[] = [];
    for (const item of pending) {
      if (item.amount > remaining) continue;
      remaining = round2(remaining - item.amount);
      advance += item.amount;
      recovered.push(item.id);
    }
    const bill: Bill = {
      id: billId,
      farmerId,
      fromDate,
      toDate,
      qty: round2(qty),
      avgFat,
      avgSnf,
      gross,
      advance: round2(advance),
      net: round2(gross - advance),
      status: "open",
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    await qrun(
      `INSERT INTO FarmerBill
        (id, dairyId, farmerId, fromDate, toDate, qty, avgFat, avgSnf, gross, advance, net, status, createdAt, paidAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bill.id,
      dairyId,
      bill.farmerId,
      bill.fromDate,
      bill.toDate,
      bill.qty,
      bill.avgFat,
      bill.avgSnf,
      bill.gross,
      bill.advance,
      bill.net,
      bill.status,
      bill.createdAt,
      null,
    );
    for (const entry of list) {
      await qrun(`UPDATE CollectionEntry SET billId = ? WHERE dairyId = ? AND id = ?`, billId, dairyId, entry.id);
    }
    for (const advId of recovered) {
      await qrun(
        `UPDATE FarmerAdvance SET recovered = 1, billId = ? WHERE dairyId = ? AND id = ?`,
        billId,
        dairyId,
        advId,
      );
    }
    newBills.push(bill);
  }
  return newBills;
}

export async function markBillPaid(dairyId: string, id: string) {
  await qrun(
    `UPDATE FarmerBill SET status = 'paid', paidAt = ? WHERE dairyId = ? AND id = ?`,
    new Date().toISOString(),
    dairyId,
    id,
  );
}

export async function updateSettings(dairyId: string, patch: Partial<Settings>) {
  const current = mapSettings(await qget(`SELECT * FROM DairySettings WHERE dairyId = ?`, dairyId));
  const next = { ...current, ...patch, logo: (patch.logo ?? current.logo) || DEFAULT_DAIRY_LOGO };
  const now = new Date().toISOString();
  await qrun(
    `UPDATE DairySettings
     SET dairyName = ?, centerName = ?, phone = ?, address = ?, logo = ?, profileComplete = ?,
         rateMethod = ?, cowMethod = ?, buffaloMethod = ?, updatedAt = ?
     WHERE dairyId = ?`,
    next.dairyName,
    next.centerName,
    next.phone,
    next.address,
    next.logo,
    next.profileComplete ? 1 : 0,
    next.rateMethod,
    next.cowMethod,
    next.buffaloMethod,
    now,
    dairyId,
  );
}

export async function resetDesk(dairyId: string) {
  await qrun(`DELETE FROM CollectionEntry WHERE dairyId = ?`, dairyId);
  await qrun(`DELETE FROM FarmerAdvance WHERE dairyId = ?`, dairyId);
  await qrun(`DELETE FROM FarmerBill WHERE dairyId = ?`, dairyId);
  await qrun(`DELETE FROM Farmer WHERE dairyId = ?`, dairyId);
  await qrun(`DELETE FROM RateChart WHERE dairyId = ?`, dairyId);
  await qrun(`DELETE FROM DairySettings WHERE dairyId = ?`, dairyId);
  await insertSettings(dairyId, defaultSettings());
  for (const chart of defaultCharts()) await insertChart(dairyId, chart);
}

export async function runDeskOp(dairyId: string, op: string, payload: Record<string, unknown>) {
  await ensureDesk(dairyId);
  switch (op) {
    case "addFarmer":
      return addFarmer(dairyId, payload as Omit<Farmer, "id" | "createdAt">);
    case "updateFarmer":
      await updateFarmer(dairyId, str(payload.id), payload as Partial<Farmer>);
      return null;
    case "deleteFarmer":
      await deleteFarmer(dairyId, str(payload.id));
      return null;
    case "addCollection":
      return addCollection(dairyId, payload as Parameters<typeof addCollection>[1]);
    case "updateCollection":
      await updateCollection(dairyId, str(payload.id), payload as Parameters<typeof updateCollection>[2]);
      return null;
    case "deleteCollection":
      await deleteCollection(dairyId, str(payload.id));
      return null;
    case "saveCharts":
      await saveCharts(dairyId, (payload.charts as RateChart[]) ?? []);
      return null;
    case "addChart":
      return addChart(dairyId, payload as Omit<RateChart, "id" | "cells">);
    case "deleteChart":
      await deleteChart(dairyId, str(payload.id));
      return null;
    case "addAdvance":
      return addAdvance(dairyId, payload as Parameters<typeof addAdvance>[1]);
    case "updateAdvance":
      await updateAdvance(dairyId, str(payload.id), payload as Parameters<typeof updateAdvance>[2]);
      return null;
    case "deleteAdvance":
      await deleteAdvance(dairyId, str(payload.id));
      return null;
    case "deleteBill":
      await deleteBill(dairyId, str(payload.id));
      return null;
    case "generateBills":
      return generateBills(dairyId, str(payload.fromDate), str(payload.toDate));
    case "markBillPaid":
      await markBillPaid(dairyId, str(payload.id));
      return null;
    case "updateSettings":
      await updateSettings(dairyId, payload as Partial<Settings>);
      return null;
    case "resetDemo":
      await resetDesk(dairyId);
      return null;
    default:
      throw new CustomerError("Unknown desk action");
  }
}

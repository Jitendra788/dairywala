import { createHash, randomInt, randomUUID } from "node:crypto";
import { CustomerError } from "@/lib/customers/errors";
import { assertDairy, qall, qget, qrun } from "@/lib/customers/db";
import { DEFAULT_DAIRY_ID } from "@/lib/customers/context";
import { ensureDesk } from "@/lib/desk/service";
import { loginDesk } from "@/lib/desk/auth-service";
import { defaultSettings } from "@/lib/desk/defaults";
import { sendVerifyEmail } from "@/lib/platform/mail";
import { todayISO } from "@/lib/dates";
import { DAIRY_CATEGORIES, type PlatformStats, type PlatformUser } from "@/lib/platform/types";

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

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

function pick(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = str(row[key]);
    if (value) return value;
  }
  return "";
}

function mapUser(row: Record<string, unknown>, source: PlatformUser["source"] = "signup"): PlatformUser {
  const statusRaw = str(row.status) || "pending";
  const status: PlatformUser["status"] =
    statusRaw === "cancelled" || statusRaw === "blocked"
      ? statusRaw
      : statusRaw === "active"
        ? "active"
        : "pending";
  const moneyIn = num(row, "customerPaid") + num(row, "walkInPaid");
  return {
    id: str(row.id),
    email: str(row.email),
    username: str(row.username) || str(row.email) || str(row.dairyName),
    password: str(row.passwordPlain),
    name: str(row.name),
    role: str(row.role) === "platform_admin" ? "platform_admin" : "dairy_owner",
    status,
    category: str(row.category),
    dairyId: row.dairyId ? str(row.dairyId) : null,
    dairyName: str(row.dairyName),
    emailVerifiedAt: row.emailVerifiedAt ? str(row.emailVerifiedAt) : null,
    lastLoginAt: row.lastLoginAt ? str(row.lastLoginAt) : null,
    createdAt: str(row.createdAt),
    otpCode: row.otpCode ? str(row.otpCode) : null,
    otpExpiresAt: row.otpExpiresAt || row.expiresAt ? str(row.otpExpiresAt || row.expiresAt) : null,
    phone: str(row.phone),
    centerName: str(row.centerName),
    farmers: num(row, "farmers"),
    customers: num(row, "customers"),
    collectionQty: num(row, "collectionQty"),
    collectionAmount: num(row, "collectionAmount"),
    moneyIn,
    source,
    location: str(row.location) || str(row.address) || str(row.centerName),
    planId: str(row.planId),
    planName: str(row.planName) || "Basic",
    planStatus: str(row.planStatus),
    planExpiresAt: row.planExpiresAt ? str(row.planExpiresAt) : null,
    todayQty: num(row, "todayQty"),
    staffCount: num(row, "staffCount"),
    usersCount: 1 + num(row, "staffCount"),
    lastDevice: str(row.lastDevice) || "Web",
  };
}

const USAGE_COLS = `
  COALESCE(uf.farmers, 0) AS farmers,
  COALESCE(uc.customers, 0) AS customers,
  COALESCE(ue.collectionQty, 0) AS collectionQty,
  COALESCE(ue.collectionAmount, 0) AS collectionAmount,
  COALESCE(up.customerPaid, 0) AS customerPaid,
  COALESCE(uw.walkInPaid, 0) AS walkInPaid,
  COALESCE(ut.todayQty, 0) AS todayQty,
  COALESCE(us.staffCount, 0) AS staffCount
`;

function usageJoins(alias: string) {
  return `
  LEFT JOIN (SELECT dairyId, COUNT(*) AS farmers FROM Farmer GROUP BY dairyId) uf ON uf.dairyId = ${alias}
  LEFT JOIN (SELECT dairyId, COUNT(*) AS customers FROM Customer GROUP BY dairyId) uc ON uc.dairyId = ${alias}
  LEFT JOIN (SELECT dairyId, SUM(qty) AS collectionQty, SUM(amount) AS collectionAmount FROM CollectionEntry GROUP BY dairyId) ue ON ue.dairyId = ${alias}
  LEFT JOIN (SELECT dairyId, SUM(amount) AS customerPaid FROM CustomerPayment GROUP BY dairyId) up ON up.dairyId = ${alias}
  LEFT JOIN (SELECT dairyId, SUM(paidAmount) AS walkInPaid FROM DailyMilkDelivery GROUP BY dairyId) uw ON uw.dairyId = ${alias}
  LEFT JOIN (SELECT dairyId, SUM(qty) AS todayQty FROM CollectionEntry WHERE date = ? GROUP BY dairyId) ut ON ut.dairyId = ${alias}
  LEFT JOIN (SELECT dairyId, COUNT(*) AS staffCount FROM PlatformStaff GROUP BY dairyId) us ON us.dairyId = ${alias}
  `;
}

function dairyIdFromName(name: string, email = "") {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  const tag = (email ? sha256(email).slice(0, 6) : randomUUID().slice(0, 6)).toLowerCase();
  return `d-${slug || "dairy"}-${tag}`;
}

async function issueCode(email: string, kind: "verify" | "reset" = "verify") {
  const code = String(randomInt(100000, 999999));
  await qrun(`DELETE FROM EmailVerify WHERE email = ?`, email);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await qrun(
    `INSERT INTO EmailVerify (id, email, codeHash, otpCode, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
    randomUUID(),
    email,
    sha256(code),
    code,
    expiresAt,
    nowISO(),
  );
  const mailed = await sendVerifyEmail(email, code, kind).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "email fail",
  }));
  return { emailed: mailed.ok, mailError: mailed.error };
}

export async function signupDairy(input: {
  name: string;
  email: string;
  password: string;
  dairyName: string;
  category: string;
}) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const dairyName = input.dairyName.trim();
  const password = input.password.trim();
  if (name.length < 2) throw new CustomerError("Apna naam likho");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CustomerError("Sahi email likho");
  if (password.length < 6) throw new CustomerError("Password kam se kam 6 letters ka ho");
  if (dairyName.length < 2) throw new CustomerError("Dairy ka naam likho");
  if (!DAIRY_CATEGORIES.includes(input.category as (typeof DAIRY_CATEGORIES)[number])) {
    throw new CustomerError("Dairy category choose karo");
  }
  const exists = await qget(`SELECT * FROM PlatformUser WHERE email = ?`, email);
  const existsStatus = str(exists?.status);
  const verified = Boolean(exists?.emailVerifiedAt);
  if (exists && verified && existsStatus === "active") {
    throw new CustomerError("Is email se account pehle se hai. Login karo.");
  }
  if (exists) {
    await qrun(
      `UPDATE PlatformUser SET name = ?, passwordHash = ?, passwordPlain = ?, category = ?, dairyName = ?, status = 'pending', emailVerifiedAt = NULL WHERE email = ?`,
      name,
      sha256(password),
      password,
      input.category,
      dairyName,
      email,
    );
  } else {
    await qrun(
      `INSERT INTO PlatformUser
        (id, email, name, passwordHash, passwordPlain, role, status, category, dairyId, dairyName, emailVerifiedAt, lastLoginAt, createdAt)
       VALUES (?, ?, ?, ?, ?, 'dairy_owner', 'pending', ?, NULL, ?, NULL, NULL, ?)`,
      randomUUID(),
      email,
      name,
      sha256(password),
      password,
      input.category,
      dairyName,
      nowISO(),
    );
  }
  const issued = await issueCode(email);
  return {
    email,
    emailed: issued.emailed,
    message: issued.emailed
      ? "OTP Gmail par bhej diya. Inbox / Spam check karo, phir yahan type karo."
      : "Gmail par OTP nahi gaya. Super admin se verify karwao, ya SMTP/RESEND set karo.",
  };
}

export async function resendCode(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  const user = await qget(`SELECT * FROM PlatformUser WHERE email = ?`, email);
  if (!user) throw new CustomerError("Is email se signup nahi mila");
  if (user.emailVerifiedAt && str(user.status) === "active") {
    throw new CustomerError("Email pehle se verify hai. Login karo.");
  }
  const issued = await issueCode(email);
  return {
    email,
    emailed: issued.emailed,
    message: issued.emailed
      ? "Naya OTP Gmail par gaya. Inbox / Spam dekho."
      : "Gmail par OTP nahi gaya. Super admin list se verify karo.",
  };
}

export async function verifyEmail(emailRaw: string, code: string) {
  const email = emailRaw.trim().toLowerCase();
  const userRow = await qget(`SELECT * FROM PlatformUser WHERE email = ?`, email);
  if (!userRow) throw new CustomerError("Account nahi mila");
  if (str(userRow.status) === "blocked" || str(userRow.status) === "cancelled") {
    throw new CustomerError("Ye account cancel hai");
  }
  const token = await qget(`SELECT * FROM EmailVerify WHERE email = ?`, email);
  if (!token) throw new CustomerError("Code expire ho gaya. Resend karo.");
  if (str(token.expiresAt) < nowISO()) throw new CustomerError("Code expire ho gaya. Resend karo.");
  const typed = code.trim();
  const match = (token.otpCode && str(token.otpCode) === typed) || str(token.codeHash) === sha256(typed);
  if (!match) throw new CustomerError("Code galat hai");
  const user = mapUser(userRow);
  let dairyId = user.dairyId;
  if (!dairyId) {
    dairyId = dairyIdFromName(user.dairyName, user.email);
    await qrun(`INSERT OR IGNORE INTO Dairy (id, name, createdAt) VALUES (?, ?, ?)`, dairyId, user.dairyName, nowISO());
    await assertDairy(dairyId);
    await qrun(
      `INSERT OR IGNORE INTO DairyAuth (dairyId, username, passwordHash, isDefault, updatedAt) VALUES (?, ?, ?, 0, ?)`,
      dairyId,
      user.email,
      str(userRow.passwordHash),
      nowISO(),
    );
    const settings = defaultSettings();
    settings.dairyName = user.dairyName;
    settings.profileComplete = false;
    settings.centerName = "";
    await qrun(
      `INSERT OR IGNORE INTO DairySettings
        (dairyId, dairyName, centerName, phone, address, logo, profileComplete, rateMethod, cowMethod, buffaloMethod, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      dairyId,
      settings.dairyName,
      settings.centerName,
      settings.phone,
      settings.address,
      settings.logo,
      settings.rateMethod,
      settings.cowMethod,
      settings.buffaloMethod,
      nowISO(),
    );
    try {
      await ensureDesk(dairyId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dairy setup fail";
      throw new CustomerError(`Verify fail: ${message}`);
    }
  }
  await qrun(
    `UPDATE PlatformUser SET emailVerifiedAt = ?, status = 'active', dairyId = ? WHERE email = ?`,
    nowISO(),
    dairyId,
    email,
  );
  await qrun(`DELETE FROM EmailVerify WHERE email = ?`, email);
  return { email, dairyId };
}

export function superAdminUser() {
  return (process.env.SUPER_ADMIN_USER || "admin").trim().toLowerCase();
}

export function superAdminPass() {
  return (process.env.SUPER_ADMIN_PASS || "admin12345").trim();
}

export async function migrateSuperAdminPassword() {
  const version = await qget(`SELECT value FROM PlatformSetting WHERE key = 'adminPasswordVersion'`);
  if (str(version?.value) === "2") return;
  const hash = sha256(superAdminPass());
  await qrun(`INSERT OR IGNORE INTO PlatformSetting (key, value) VALUES ('adminPasswordHash', ?)`, hash);
  await qrun(`UPDATE PlatformSetting SET value = ? WHERE key = 'adminPasswordHash'`, hash);
  await qrun(`INSERT OR IGNORE INTO PlatformSetting (key, value) VALUES ('adminPasswordVersion', '2')`);
  await qrun(`UPDATE PlatformSetting SET value = '2' WHERE key = 'adminPasswordVersion'`);
}

async function checkSuperAdmin(username: string, password: string) {
  await migrateSuperAdminPassword();
  const user = username.trim().toLowerCase();
  const pass = password.trim();
  if (user !== superAdminUser()) return false;
  const stored = await qget(`SELECT value FROM PlatformSetting WHERE key = 'adminPasswordHash'`);
  if (stored?.value) return sha256(pass) === str(stored.value);
  return pass === superAdminPass();
}

export async function changeSuperAdminPassword(current: string, next: string) {
  if (!(await checkSuperAdmin(superAdminUser(), current.trim()))) {
    throw new CustomerError("Current password galat hai");
  }
  const password = next.trim();
  if (password.length < 8) throw new CustomerError("Naya password kam se kam 8 letters ka ho");
  if (password === current.trim()) throw new CustomerError("Naya password purane se alag hona chahiye");
  const hash = sha256(password);
  await qrun(`INSERT OR IGNORE INTO PlatformSetting (key, value) VALUES ('adminPasswordHash', ?)`, hash);
  await qrun(`UPDATE PlatformSetting SET value = ? WHERE key = 'adminPasswordHash'`, hash);
  return { ok: true };
}

export async function requestPasswordReset(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CustomerError("Sahi email likho");
  const user = await qget(`SELECT * FROM PlatformUser WHERE email = ?`, email);
  if (!user || str(user.status) === "cancelled" || str(user.status) === "blocked") {
    return { emailed: true, message: "Agar is email ka account hai to OTP inbox / spam mein jayega." };
  }
  const issued = await issueCode(email, "reset");
  return {
    emailed: issued.emailed,
    message: issued.emailed
      ? "OTP email par bhej diya. Inbox / Spam check karo, phir yahan type karo."
      : "Email nahi gaya. Thodi der baad try karo, ya Super admin se reset karwao.",
  };
}

export async function resetPassword(emailRaw: string, code: string, nextPassword: string) {
  const email = emailRaw.trim().toLowerCase();
  const password = nextPassword.trim();
  if (password.length < 6) throw new CustomerError("Password kam se kam 6 letters ka ho");
  const user = await qget(`SELECT * FROM PlatformUser WHERE email = ?`, email);
  if (!user) throw new CustomerError("Account nahi mila");
  if (str(user.status) === "cancelled" || str(user.status) === "blocked") {
    throw new CustomerError("Ye account cancel hai");
  }
  const token = await qget(`SELECT * FROM EmailVerify WHERE email = ?`, email);
  if (!token) throw new CustomerError("Code expire ho gaya. Resend karo.");
  if (str(token.expiresAt) < nowISO()) throw new CustomerError("Code expire ho gaya. Resend karo.");
  const typed = code.trim();
  const match = (token.otpCode && str(token.otpCode) === typed) || str(token.codeHash) === sha256(typed);
  if (!match) throw new CustomerError("Code galat hai");
  await qrun(
    `UPDATE PlatformUser SET passwordHash = ?, passwordPlain = ? WHERE email = ?`,
    sha256(password),
    password,
    email,
  );
  await qrun(`DELETE FROM EmailVerify WHERE email = ?`, email);
  return { ok: true, email };
}

export async function loginPlatform(username: string, password: string) {
  if (await checkSuperAdmin(username, password)) {
    return {
      username: "admin",
      email: "",
      name: "Super admin",
      dairyId: "",
      role: "platform_admin" as const,
      isDefault: false,
    };
  }
  const key = username.trim().toLowerCase();
  const pass = password.trim();
  const byEmail = await qget(`SELECT * FROM PlatformUser WHERE email = ?`, key);
  if (byEmail) {
    const user = mapUser(byEmail);
    if (str(byEmail.passwordHash) !== sha256(pass)) throw new CustomerError("Email ya password galat hai");
    if (!user.emailVerifiedAt || user.status === "blocked" || user.status === "cancelled") {
      const issued = await issueCode(user.email);
      return {
        needVerify: true,
        username: user.email,
        email: user.email,
        emailed: issued.emailed,
        message: issued.emailed
          ? "OTP Gmail par bheja. Inbox / Spam dekho aur code type karo."
          : "Gmail par OTP nahi gaya. Super admin se verify karwao.",
      };
    }
    if (!user.dairyId) throw new CustomerError("Dairy abhi ready nahi. Verify complete karo.");
    await qrun(`UPDATE PlatformUser SET lastLoginAt = ? WHERE id = ?`, nowISO(), user.id);
    return {
      username: user.email,
      email: user.email,
      name: user.name,
      dairyId: user.dairyId,
      role: user.role,
      isDefault: false,
    };
  }
  if (key.includes("@")) throw new CustomerError("Email ya password galat hai");
  const desk = await loginDesk(DEFAULT_DAIRY_ID, username, password);
  return {
    username: desk.username,
    email: "",
    name: desk.username,
    dairyId: DEFAULT_DAIRY_ID,
    role: "dairy_owner" as const,
    isDefault: desk.isDefault,
  };
}

export async function listPlatformUsers(): Promise<PlatformUser[]> {
  const today = todayISO();
  const extraSelect = `s.address AS location, sub.planId, sub.status AS planStatus, sub.expiresAt AS planExpiresAt, p.name AS planName, ${USAGE_COLS}`;
  const rows = await qall(
    `SELECT u.*, s.phone, s.centerName, v.otpCode, v.expiresAt AS otpExpiresAt, ${extraSelect}
     FROM PlatformUser u
     LEFT JOIN DairySettings s ON s.dairyId = u.dairyId
     LEFT JOIN EmailVerify v ON v.email = u.email
     LEFT JOIN PlatformSubscription sub ON sub.dairyId = u.dairyId
     LEFT JOIN PlatformPlan p ON p.id = sub.planId
     ${usageJoins("u.dairyId")}
     ORDER BY u.createdAt DESC`,
    today,
  );
  const users = rows.map((row) => mapUser(row, "signup"));
  const extras = await qall(
    `SELECT d.id AS dairyId, d.name AS dairyName, d.createdAt, s.phone, s.centerName,
            a.username AS deskUsername, a.isDefault AS deskDefault, m.status AS metaStatus,
            ${extraSelect}
     FROM Dairy d
     LEFT JOIN PlatformUser pu ON pu.dairyId = d.id
     LEFT JOIN DairySettings s ON s.dairyId = d.id
     LEFT JOIN DairyAuth a ON a.dairyId = d.id
     LEFT JOIN PlatformDairyMeta m ON m.dairyId = d.id
     LEFT JOIN PlatformSubscription sub ON sub.dairyId = d.id
     LEFT JOIN PlatformPlan p ON p.id = sub.planId
     ${usageJoins("d.id")}
     WHERE pu.id IS NULL
     ORDER BY d.createdAt DESC`,
    today,
  );
  const desks = extras.map((row) => {
    const deskUser = pick(row, "deskUsername", "deskusername", "username");
    const deskDefault = flag(row.deskDefault ?? row.deskdefault ?? row.isDefault);
    const meta = str(row.metaStatus);
    const status = meta === "blocked" || meta === "cancelled" ? meta : "active";
    return mapUser(
      {
        ...row,
        id: `desk:${str(row.dairyId)}`,
        email: "",
        name: str(row.dairyName) || str(row.dairyId),
        role: "dairy_owner",
        status,
        category: "Desk",
        emailVerifiedAt: row.createdAt,
        passwordPlain: deskDefault ? deskUser : "",
        username: deskUser,
      },
      "desk",
    );
  });
  return [...users, ...desks];
}

export async function platformStats(): Promise<PlatformStats> {
  const row = await qget(
    `SELECT
        COUNT(*) AS opened,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
        COALESCE(SUM(CASE WHEN status IN ('cancelled', 'blocked') THEN 1 ELSE 0 END), 0) AS cancelled
     FROM PlatformUser`,
  );
  const dairies = await qget(`SELECT COUNT(*) AS dairies FROM Dairy`);
  const paid = await qget(`SELECT COALESCE(SUM(amount), 0) AS t FROM CustomerPayment`);
  const walkIn = await qget(`SELECT COALESCE(SUM(paidAmount), 0) AS t FROM DailyMilkDelivery`);
  const milk = await qget(`SELECT COALESCE(SUM(qty), 0) AS t FROM CollectionEntry`);
  return {
    opened: Number(row?.opened || 0),
    dairies: Number(dairies?.dairies || 0),
    pending: Number(row?.pending || 0),
    active: Number(row?.active || 0),
    cancelled: Number(row?.cancelled || 0),
    moneyIn: Number(paid?.t || 0) + Number(walkIn?.t || 0),
    collectionQty: Number(milk?.t || 0),
  };
}

export async function deletePlatformUser(id: string) {
  const row = await qget(`SELECT * FROM PlatformUser WHERE id = ?`, id);
  if (!row) throw new CustomerError("User nahi mila", 404);
  const email = str(row.email);
  const dairyId = row.dairyId ? str(row.dairyId) : "";
  await qrun(`DELETE FROM EmailVerify WHERE email = ?`, email);
  await qrun(`DELETE FROM PlatformUser WHERE id = ?`, id);
  if (dairyId && dairyId !== DEFAULT_DAIRY_ID) {
    await wipeDairyRows(dairyId);
  }
  return { ok: true };
}

export async function wipeDairyRows(dairyId: string) {
  if (!dairyId || dairyId === DEFAULT_DAIRY_ID) {
    throw new CustomerError("Tony Dairy / owner desk delete nahi hota");
  }
  for (const table of [
    "CollectionEntry",
    "FarmerAdvance",
    "FarmerBill",
    "Farmer",
    "RateChart",
    "Expense",
    "CustomerPayment",
    "MilkLedger",
    "DailyMilkDelivery",
    "CustomerSubscription",
    "MonthlyBill",
    "Customer",
    "DairySettings",
    "DairyAuth",
    "PlatformSubscription",
    "PlatformStaff",
    "PlatformDairyMeta",
    "PlatformPayment",
  ]) {
    await qrun(`DELETE FROM ${table} WHERE dairyId = ?`, dairyId);
  }
  await qrun(`DELETE FROM PlatformTicket WHERE dairyId = ?`, dairyId);
  await qrun(`DELETE FROM Dairy WHERE id = ?`, dairyId);
}

export async function setUserStatus(id: string, status: "active" | "blocked" | "pending" | "cancelled") {
  const row = await qget(`SELECT * FROM PlatformUser WHERE id = ?`, id);
  if (!row) throw new CustomerError("User nahi mila", 404);
  if (status === "active" && !row.emailVerifiedAt) {
    await adminVerifyUser(id);
  }
  await qrun(`UPDATE PlatformUser SET status = ? WHERE id = ?`, status, id);
  return mapUser((await qget(`SELECT * FROM PlatformUser WHERE id = ?`, id))!);
}

export async function adminVerifyUser(id: string) {
  const row = await qget(`SELECT * FROM PlatformUser WHERE id = ?`, id);
  if (!row) throw new CustomerError("User nahi mila", 404);
  if (str(row.status) === "cancelled" || str(row.status) === "blocked") {
    await qrun(`UPDATE PlatformUser SET status = 'pending' WHERE id = ?`, id);
  }
  if (row.emailVerifiedAt && row.dairyId) {
    await qrun(`UPDATE PlatformUser SET status = 'active' WHERE id = ?`, id);
    return mapUser((await qget(`SELECT * FROM PlatformUser WHERE id = ?`, id))!);
  }
  await qrun(`DELETE FROM EmailVerify WHERE email = ?`, str(row.email));
  const code = String(randomInt(100000, 999999));
  await qrun(
    `INSERT INTO EmailVerify (id, email, codeHash, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)`,
    randomUUID(),
    str(row.email),
    sha256(code),
    new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    nowISO(),
  );
  return verifyEmail(str(row.email), code);
}

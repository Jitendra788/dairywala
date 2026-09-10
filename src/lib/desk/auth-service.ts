import { createHash } from "node:crypto";
import { CustomerError } from "@/lib/customers/errors";
import { assertDairy, qget, qrun } from "@/lib/customers/db";

export type PublicAuth = {
  username: string;
  isDefault: boolean;
  updatedAt: string;
};

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function flag(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "t" || value === "true";
}

async function ensureAuth(dairyId: string) {
  await assertDairy(dairyId);
  const row = await qget(`SELECT * FROM DairyAuth WHERE dairyId = ?`, dairyId);
  if (row) {
    return {
      username: String(row.username),
      passwordHash: String(row.passwordHash),
      isDefault: flag(row.isDefault),
      updatedAt: String(row.updatedAt),
    };
  }
  const now = new Date().toISOString();
  const record = {
    username: "admin",
    passwordHash: sha256("admin"),
    isDefault: true,
    updatedAt: now,
  };
  await qrun(
    `INSERT INTO DairyAuth (dairyId, username, passwordHash, isDefault, updatedAt) VALUES (?, ?, ?, ?, ?)`,
    dairyId,
    record.username,
    record.passwordHash,
    1,
    now,
  );
  return record;
}

export async function getPublicAuth(dairyId: string): Promise<PublicAuth> {
  const auth = await ensureAuth(dairyId);
  return {
    username: auth.username,
    isDefault: auth.isDefault,
    updatedAt: auth.updatedAt,
  };
}

export async function loginDesk(dairyId: string, username: string, password: string) {
  const auth = await ensureAuth(dairyId);
  if (auth.username.toLowerCase() !== username.trim().toLowerCase() || auth.passwordHash !== sha256(password)) {
    throw new CustomerError("Username ya password galat hai");
  }
  return {
    username: auth.username,
    isDefault: auth.isDefault,
  };
}

export async function changeDeskPassword(dairyId: string, current: string, next: string) {
  const auth = await ensureAuth(dairyId);
  if (auth.passwordHash !== sha256(current)) throw new CustomerError("Current password galat hai");
  if (next.trim().length < 4) throw new CustomerError("Naya password kam se kam 4 letters ka ho");
  if (current === next) throw new CustomerError("Naya password purane se alag hona chahiye");
  await qrun(
    `UPDATE DairyAuth SET passwordHash = ?, isDefault = 0, updatedAt = ? WHERE dairyId = ?`,
    sha256(next.trim()),
    new Date().toISOString(),
    dairyId,
  );
}

export async function changeDeskUsername(dairyId: string, currentPassword: string, nextUsername: string) {
  const auth = await ensureAuth(dairyId);
  if (auth.passwordHash !== sha256(currentPassword)) throw new CustomerError("Password galat hai");
  const username = nextUsername.trim();
  if (username.length < 3) throw new CustomerError("Username kam se kam 3 letters ka ho");
  await qrun(
    `UPDATE DairyAuth SET username = ?, updatedAt = ? WHERE dairyId = ?`,
    username,
    new Date().toISOString(),
    dairyId,
  );
  return { username };
}

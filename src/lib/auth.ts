import { customerApi } from "@/lib/customers/client";
import { resetDesk } from "@/lib/store";

export type AuthRecord = {
  username: string;
  isDefault: boolean;
  updatedAt: string;
};

export type AuthSession = {
  username: string;
  email?: string;
  name?: string;
  dairyId?: string;
  dairyName?: string;
  role?: "platform_admin" | "dairy_owner";
  impersonating?: boolean;
  loggedInAt: string;
  remember: boolean;
};

const SESSION_KEY = "tony-dairy-session";
const SESSION_COOKIE = "td_session";
const ADMIN_RESUME = "td_admin_resume";
const OLD_KEYS = ["tony-dairy-auth", "tony-dairy-session", "tony-dairy-auth-admin-reset"];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSession: AuthSession | null = null;
let cachedAuth: AuthRecord | null = null;

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function clearLegacyStorage() {
  if (typeof window === "undefined") return;
  for (const key of OLD_KEYS) localStorage.removeItem(key);
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function writeCookie(name: string, value: string, days: number) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY) || readCookie(SESSION_COOKIE);
  if (raw === cachedRaw) return cachedSession;
  cachedRaw = raw;
  if (!raw) {
    cachedSession = null;
    return null;
  }
  try {
    cachedSession = JSON.parse(raw) as AuthSession;
    return cachedSession;
  } catch {
    cachedSession = null;
    return null;
  }
}

function writeSession(session: AuthSession) {
  const raw = JSON.stringify(session);
  sessionStorage.removeItem(SESSION_KEY);
  clearCookie(SESSION_COOKIE);
  if (session.remember) writeCookie(SESSION_COOKIE, raw, 30);
  else sessionStorage.setItem(SESSION_KEY, raw);
  clearCookie("td_dairy");
  if (session.dairyId) writeCookie("td_dairy", session.dairyId, 30);
  cachedRaw = raw;
  cachedSession = session;
  emit();
}

export function getSessionSnapshot(): AuthSession | null {
  if (typeof window === "undefined") return null;
  return readSession();
}

export function getAuthServerSnapshot(): AuthSession | null {
  return null;
}

export async function fetchAuthRecord() {
  clearLegacyStorage();
  cachedAuth = await customerApi<AuthRecord>("/api/auth");
  return cachedAuth;
}

export function getAuthRecord() {
  return cachedAuth;
}

export function currentSession() {
  return readSession();
}

export function isLoggedIn() {
  return Boolean(readSession());
}

export async function ensureDefaultAuth() {
  await fetchAuthRecord();
}

export async function login(username: string, password: string, remember: boolean) {
  const auth = await customerApi<
    AuthRecord & {
      username: string;
      email?: string;
      name?: string;
      dairyId?: string;
      role?: AuthSession["role"];
      needVerify?: boolean;
    }
  >("/api/auth", {
    method: "POST",
    body: JSON.stringify({ op: "login", username, password }),
  });
  if (auth.needVerify) {
    const err = new Error("Pehle email verify karo") as Error & { needVerify: true; email: string };
    err.needVerify = true;
    err.email = auth.email || username;
    throw err;
  }
  cachedAuth = {
    username: auth.username,
    isDefault: auth.isDefault,
    updatedAt: auth.updatedAt ?? new Date().toISOString(),
  };
  resetDesk();
  writeSession({
    username: auth.username,
    email: auth.email,
    name: auth.name,
    dairyId: auth.dairyId,
    role: auth.role,
    loggedInAt: new Date().toISOString(),
    remember,
  });
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  clearCookie(SESSION_COOKIE);
  clearCookie("td_dairy");
  clearCookie(ADMIN_RESUME);
  localStorage.removeItem(SESSION_KEY);
  cachedRaw = null;
  cachedSession = null;
  resetDesk();
  emit();
}

export function startImpersonation(dairy: {
  dairyId: string;
  username: string;
  email?: string;
  name?: string;
  dairyName?: string;
}) {
  const admin = readSession();
  if (!admin || admin.role !== "platform_admin" || admin.impersonating) {
    throw new Error("Super admin session nahi mili");
  }
  writeCookie(ADMIN_RESUME, JSON.stringify(admin), 1);
  resetDesk();
  writeSession({
    username: dairy.username,
    email: dairy.email,
    name: dairy.name,
    dairyId: dairy.dairyId,
    dairyName: dairy.dairyName,
    role: "dairy_owner",
    impersonating: true,
    loggedInAt: new Date().toISOString(),
    remember: false,
  });
}

export function stopImpersonation() {
  const raw = readCookie(ADMIN_RESUME);
  clearCookie(ADMIN_RESUME);
  resetDesk();
  if (!raw) {
    logout();
    return false;
  }
  try {
    writeSession(JSON.parse(raw) as AuthSession);
    return true;
  } catch {
    logout();
    return false;
  }
}

export async function signupAccount(input: {
  name: string;
  email: string;
  password: string;
  dairyName: string;
  category: string;
}) {
  return customerApi<{ email: string; emailed: boolean; code?: string; message: string }>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ op: "signup", ...input }),
  });
}

export async function verifyAccount(email: string, code: string) {
  return customerApi<{ email: string; dairyId: string }>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ op: "verify", email, code }),
  });
}

export async function requestPasswordReset(email: string) {
  return customerApi<{ emailed: boolean; message: string }>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ op: "forgot", email }),
  });
}

export async function resetAccountPassword(email: string, code: string, password: string) {
  return customerApi<{ ok: boolean; email: string }>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ op: "reset", email, code, password }),
  });
}

export async function resendVerifyCode(email: string) {
  return customerApi<{ email: string; emailed: boolean; code?: string; message: string }>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ op: "resend", email }),
  });
}

export async function changePassword(current: string, next: string) {
  if (!readSession()) throw new Error("Pehle login karo");
  cachedAuth = await customerApi<AuthRecord>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ op: "changePassword", current, next }),
  });
}

export async function changeUsername(currentPassword: string, nextUsername: string) {
  const session = readSession();
  if (!session) throw new Error("Pehle login karo");
  cachedAuth = await customerApi<AuthRecord>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ op: "changeUsername", current: currentPassword, username: nextUsername }),
  });
  writeSession({ ...session, username: cachedAuth.username });
}

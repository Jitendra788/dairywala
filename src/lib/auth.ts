import { customerApi } from "@/lib/customers/client";

export type AuthRecord = {
  username: string;
  isDefault: boolean;
  updatedAt: string;
};

export type AuthSession = {
  username: string;
  loggedInAt: string;
  remember: boolean;
};

const SESSION_KEY = "tony-dairy-session";
const SESSION_COOKIE = "td_session";
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
  const auth = await customerApi<AuthRecord & { username: string }>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ op: "login", username, password }),
  });
  cachedAuth = {
    username: auth.username,
    isDefault: auth.isDefault,
    updatedAt: auth.updatedAt ?? new Date().toISOString(),
  };
  writeSession({
    username: auth.username,
    loggedInAt: new Date().toISOString(),
    remember,
  });
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  clearCookie(SESSION_COOKIE);
  localStorage.removeItem(SESSION_KEY);
  cachedRaw = null;
  cachedSession = null;
  emit();
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

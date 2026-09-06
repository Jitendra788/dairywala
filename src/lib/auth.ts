export type AuthRecord = {
  username: string;
  passwordHash: string;
  isDefault: boolean;
  updatedAt: string;
};

export type AuthSession = {
  username: string;
  loggedInAt: string;
  remember: boolean;
};

const AUTH_KEY = "tony-dairy-auth";
const SESSION_KEY = "tony-dairy-session";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSessionSnapshot(): AuthSession | null {
  if (typeof window === "undefined") return null;
  return readSession();
}

export function getAuthServerSnapshot(): AuthSession | null {
  return null;
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readAuth(): AuthRecord | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthRecord;
  } catch {
    return null;
  }
}

function writeAuth(record: AuthRecord) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(record));
}

function sessionStore(remember: boolean) {
  return remember ? localStorage : sessionStorage;
}

function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStore(session.remember).setItem(SESSION_KEY, JSON.stringify(session));
  emit();
}

export async function ensureDefaultAuth() {
  if (typeof window === "undefined") return;
  if (readAuth()) return;
  writeAuth({
    username: "admin",
    passwordHash: await sha256("admin"),
    isDefault: true,
    updatedAt: new Date().toISOString(),
  });
}

export function getAuthRecord() {
  return readAuth();
}

export function currentSession() {
  return readSession();
}

export function isLoggedIn() {
  return Boolean(readSession());
}

export async function login(username: string, password: string, remember: boolean) {
  await ensureDefaultAuth();
  const auth = readAuth();
  if (!auth) throw new Error("Login setup fail hua");
  const hash = await sha256(password);
  if (auth.username.toLowerCase() !== username.trim().toLowerCase() || auth.passwordHash !== hash) {
    throw new Error("Username ya password galat hai");
  }
  writeSession({
    username: auth.username,
    loggedInAt: new Date().toISOString(),
    remember,
  });
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  emit();
}

export async function changePassword(current: string, next: string) {
  const auth = readAuth();
  const session = readSession();
  if (!auth || !session) throw new Error("Pehle login karo");
  if ((await sha256(current)) !== auth.passwordHash) {
    throw new Error("Current password galat hai");
  }
  if (next.trim().length < 4) throw new Error("Naya password kam se kam 4 letters ka ho");
  if (current === next) throw new Error("Naya password purane se alag hona chahiye");
  writeAuth({
    ...auth,
    passwordHash: await sha256(next.trim()),
    isDefault: false,
    updatedAt: new Date().toISOString(),
  });
}

export async function changeUsername(currentPassword: string, nextUsername: string) {
  const auth = readAuth();
  const session = readSession();
  if (!auth || !session) throw new Error("Pehle login karo");
  if ((await sha256(currentPassword)) !== auth.passwordHash) {
    throw new Error("Password galat hai");
  }
  const username = nextUsername.trim();
  if (username.length < 3) throw new Error("Username kam se kam 3 letters ka ho");
  writeAuth({
    ...auth,
    username,
    updatedAt: new Date().toISOString(),
  });
  writeSession({ ...session, username });
}

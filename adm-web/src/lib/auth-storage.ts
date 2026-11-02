import type { AuthSession, Authz } from "@/lib/types";

const SESSION_KEY = "adm.auth.session";
const AUTHZ_KEY = "adm.auth.authz";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage 被禁用时不影响本次会话（刷新后会要求重新登录） */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isExpired(session: AuthSession | null): boolean {
  if (!session) return true;
  const expire = Number(session.expireMs);
  return !Number.isFinite(expire) || expire <= Date.now();
}

export function readSession(): AuthSession | null {
  const session = readJson<AuthSession>(SESSION_KEY);
  if (!session?.token) return null;
  if (isExpired(session)) {
    clearSession();
    return null;
  }
  return session;
}

export function saveSession(session: AuthSession): void {
  writeJson(SESSION_KEY, session);
}

export function clearSession(): void {
  remove(SESSION_KEY);
  remove(AUTHZ_KEY);
}

export function readAuthz(): Authz | null {
  return readJson<Authz>(AUTHZ_KEY);
}

export function saveAuthz(authz: Authz): void {
  writeJson(AUTHZ_KEY, authz);
}

export function clearAuthz(): void {
  remove(AUTHZ_KEY);
}

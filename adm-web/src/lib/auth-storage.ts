import type { AuthSession, Authz } from "@/lib/types";

const SESSION_KEY = "adm.auth.session";
const AUTHZ_KEY = "adm.auth.authz";

/**
 * 会话失效广播（HTTP 401 或本地令牌过期）。
 *
 * `lib/http.ts` 是纯请求层，不该直接认识 React / Router；用 DOM 事件把
 * 「令牌已作废」传给 AuthProvider，由它统一清状态并跳登录。
 */
export const SESSION_EXPIRED_EVENT = "adm:session-expired";

export function notifySessionExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

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
    // 本地已经判定过期，但 React 里的 session 状态还是旧的；广播一次让界面同步登出。
    notifySessionExpired();
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

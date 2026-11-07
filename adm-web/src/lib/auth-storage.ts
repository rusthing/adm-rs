import type { AuthSession, Authz } from "@/lib/types";
import {
  SESSION_EXPIRED_EVENT,
  clearSession,
  isExpired,
  notifySessionExpired,
  readSession,
  saveSession,
} from "@/lib/auth-core";

/**
 * 会话存储统一交给 `lib/auth-core.ts`（六端共用的认证内核）。
 * 这里保留 `authz`（当前用户的菜单 / 权限缓存）与对外导出名，避免页面批量改动。
 */
export { SESSION_EXPIRED_EVENT, clearSession, isExpired, notifySessionExpired, readSession, saveSession };
export type { AuthSession };

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

export function readAuthz(): Authz | null {
  return readJson<Authz>(AUTHZ_KEY);
}

export function saveAuthz(authz: Authz): void {
  writeJson(AUTHZ_KEY, authz);
}

export function clearAuthz(): void {
  remove(AUTHZ_KEY);
}

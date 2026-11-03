import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { login as loginApi, logout as logoutApi } from "@/lib/api";
import {
  clearAuthz,
  clearSession,
  readAuthz,
  readSession,
  saveAuthz,
  saveSession,
} from "@/lib/auth-storage";
import { sm3 } from "@/lib/sm3";
import type { AuthSession, Authz } from "@/lib/types";
import { loadAuthz } from "@/auth/authz";

interface AuthContextValue {
  session: AuthSession | null;
  authz: Authz | null;
  authzError: string | null;
  authzLoading: boolean;
  login: (account: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthz: () => Promise<void>;
  hasPerm: (urnPrefix: string) => boolean;
  updateSession: (patch: Partial<AuthSession>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const [authz, setAuthz] = useState<Authz | null>(() => {
    const current = readSession();
    const cached = readAuthz();
    // 旧版本缓存可能没有 menus 字段（曾用前端启发式拼权限），直接丢弃
    return current && cached?.userId === current.userId && Array.isArray(cached.menus) && Array.isArray(cached.scopes)
      ? cached
      : null;
  });
  const [authzError, setAuthzError] = useState<string | null>(null);
  const [authzLoading, setAuthzLoading] = useState(false);

  useEffect(() => {
    if (!session) {
      setAuthz(null);
      setAuthzError(null);
      return;
    }
    // 有缓存也刷新一次：后端菜单 / 角色授权变更后，不必重新登录就能生效
    let cancelled = false;
    setAuthzLoading(authz?.userId !== session.userId);
    loadAuthz(session)
      .then((next) => {
        if (cancelled) return;
        setAuthz(next);
        saveAuthz(next);
        setAuthzError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAuthzError(error instanceof Error ? error.message : "权限信息加载失败");
      })
      .finally(() => {
        if (!cancelled) setAuthzLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.userId]);

  const login = useCallback(async (account: string, password: string) => {
    const result = await loginApi({ account: account.trim(), loginPswd: sm3(password) });
    const next: AuthSession = {
      token: result.token,
      tokenType: result.tokenType,
      expireMs: result.expireMs,
      userId: result.userId,
      name: result.name,
      nickName: result.nickName,
      loginPswdDefault: result.loginPswdDefault,
      loginLogId: result.loginLogId,
    };
    // 切换用户时先清掉上一位用户的权限缓存，避免加载期间串用旧菜单
    clearAuthz();
    setAuthz(null);
    saveSession(next);
    setSession(next);

    // 登录后统一走 /adm/auth/me，失败时也允许进入，页面上会给出提示。
    setAuthzLoading(true);
    try {
      const nextAuthz = await loadAuthz(next);
      setAuthz(nextAuthz);
      saveAuthz(nextAuthz);
      setAuthzError(null);
    } catch (error) {
      setAuthzError(error instanceof Error ? error.message : "权限信息加载失败");
    } finally {
      setAuthzLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      /* 令牌已失效时登出接口可能返回业务错误；本地会话仍需清掉 */
    }
    clearSession();
    clearAuthz();
    setSession(null);
    setAuthz(null);
    setAuthzError(null);
  }, []);

  const refreshAuthz = useCallback(async () => {
    if (!session) return;
    setAuthzLoading(true);
    try {
      const next = await loadAuthz(session);
      setAuthz(next);
      saveAuthz(next);
      setAuthzError(null);
    } catch (error) {
      setAuthzError(error instanceof Error ? error.message : "权限信息加载失败");
    } finally {
      setAuthzLoading(false);
    }
  }, [session]);

  const hasPerm = useCallback(
    (urnPrefix: string) => {
      if (!session) return false;
      if (!authz) return false;
      const prefix = urnPrefix.toLowerCase();
      return authz.permUrns.some((urn) => urn.toLowerCase().startsWith(prefix));
    },
    [authz, session],
  );

  const updateSession = useCallback((patch: Partial<AuthSession>) => {
    setSession((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      saveSession(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      authz,
      authzError,
      authzLoading,
      login,
      logout,
      refreshAuthz,
      hasPerm,
      updateSession,
    }),
    [session, authz, authzError, authzLoading, login, logout, refreshAuthz, hasPerm, updateSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return context;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, login as loginApi, logout as logoutApi } from "@/lib/api";
import {
  SESSION_EXPIRED_EVENT,
  clearAuthz,
  clearSession,
  readAuthz,
  readSession,
  saveAuthz,
  saveSession,
} from "@/lib/auth-storage";
import { sm3 } from "@/lib/sm3";
import type { AdmMeVo, AuthSession, Authz } from "@/lib/types";
import { matchPermUrn } from "@/auth/perm";

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

/**
 * 把 `/adm/auth/me` 的聚合结果换成前端鉴权视图。
 *
 * `userId` 取自服务端返回的 `me.user`，不从本地 session 拼：一旦令牌与
 * 返回用户不一致（例如网关里残留了上一位用户的会话），立刻判为异常，
 * 而不是把别人的菜单和权限缓存到本地。
 */
async function loadAuthz(expectedUserId: string): Promise<Authz> {
  const me: AdmMeVo = (await authApi.me()) as AdmMeVo;
  if (!me) throw new Error("鉴权接口未返回数据");
  if (me.user?.id !== expectedUserId) {
    throw new Error("鉴权返回的用户与当前会话不一致，请重新登录");
  }
  return {
    userId: me.user.id,
    roles: me.roles ?? [],
    perms: me.perms ?? [],
    menus: me.menus ?? [],
    permUrns: me.permUrns ?? [],
    scopes: me.scopes ?? [],
    dashboard: me.dashboard,
    loadedAt: String(Date.now()),
  };
}

/** 旧版本缓存曾用前端启发式拼权限，缺 menus / scopes 的直接作废。 */
function cachedAuthzFor(userId: string): Authz | undefined {
  const cached = readAuthz();
  return cached && cached.userId === userId && Array.isArray(cached.menus) && Array.isArray(cached.scopes)
    ? cached
    : undefined;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const token = session?.token ?? null;

  /**
   * `/me` 只由 React Query 管理：queryKey 带令牌，登录/切换账号天然只请求一次，
   * 不再出现「login 里手动拉一次 + effect 里又拉一次」的重复请求与竞态。
   * localStorage 缓存作为 initialData 先撑住首屏，随后必定后台刷新一次，
   * 保证后端改了授权不必重新登录就能生效。
   */
  const authzQuery = useQuery<Authz>({
    queryKey: ["authz", token],
    queryFn: () => loadAuthz(session!.userId),
    enabled: Boolean(session),
    staleTime: 0,
    initialDataUpdatedAt: 0,
    retry: 0,
    initialData: () => (session ? cachedAuthzFor(session.userId) : undefined),
  });

  const authz = authzQuery.data ?? null;
  const authzError = authzQuery.error
    ? authzQuery.error instanceof Error
      ? authzQuery.error.message
      : "权限信息加载失败"
    : null;
  const authzLoading = Boolean(session) && authzQuery.isPending && !authz;

  useEffect(() => {
    if (authzQuery.data) saveAuthz(authzQuery.data);
  }, [authzQuery.data]);

  /** 401 / 本地令牌过期：统一清会话、清查询缓存并带原地址回登录页。 */
  useEffect(() => {
    const onExpired = () => {
      if (!session) return;
      clearSession();
      clearAuthz();
      queryClient.clear();
      setSession(null);
      if (location.pathname !== "/login") {
        const returnUrl = `${location.pathname}${location.search}`;
        navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, { replace: true });
      }
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [session, navigate, location.pathname, location.search, queryClient]);

  const login = useCallback(
    async (account: string, password: string) => {
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
      // 切换用户时先清掉上一位用户的权限缓存与所有查询缓存（首页、列表、鉴权视图），
      // 否则 React Query 可能把上一位用户的数据带到新会话里。
      clearAuthz();
      queryClient.clear();
      saveSession(next);
      setSession(next);
      // 不在这里再拉一次 /me：setSession 换掉 queryKey 后由上面的 query 自动拉取。
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      /* 令牌已失效时登出接口可能返回业务错误；本地会话仍需清掉 */
    }
    clearSession();
    clearAuthz();
    queryClient.clear();
    setSession(null);
  }, [queryClient]);

  const { refetch: refetchAuthz } = authzQuery;
  const refreshAuthz = useCallback(async () => {
    await refetchAuthz();
  }, [refetchAuthz]);

  const hasPerm = useCallback(
    (urnPrefix: string) => {
      if (!session || !authz) return false;
      // 按路径段边界匹配，避免 GET:/adm/role 误命中 GET:/adm/role-group。
      return matchPermUrn(authz.permUrns, urnPrefix);
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

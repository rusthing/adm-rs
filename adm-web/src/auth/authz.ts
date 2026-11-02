import { authApi } from "@/lib/api";
import type { AuthSession, Authz } from "@/lib/types";

/**
 * 拉取当前用户的鉴权视图。
 *
 * 数据全部来自后端 `GET /adm/auth/me`：用户资料、角色、权限、权限 URN 与
 * 角色菜单过滤后的可见菜单。前端不再做 `id=1 / name=admin` 之类的超管启发式。
 */
export async function loadAuthz(session: AuthSession): Promise<Authz> {
  const me = await authApi.me();
  if (!me) throw new Error("鉴权接口未返回数据");

  return {
    userId: session.userId,
    roles: me.roles ?? [],
    perms: me.perms ?? [],
    menus: me.menus ?? [],
    permUrns: me.permUrns ?? [],
    loadedAt: String(Date.now()),
  };
}

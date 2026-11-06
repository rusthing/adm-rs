/**
 * 选项类列表的统一查询入口。
 *
 * 应用 / 领域 / 分组 / 菜单 / 权限这些列表会被多个页面、侧栏、授权抽屉同时用到。
 * 之前每个调用点各写一个 queryKey（`app/options`、`app/nav-groups`、`app/check-list`…），
 * 同一份数据被重复请求；更糟的是 `CrudPage` 提交后只失效 `[prefix]`（分页列表），
 * 带不走这些别名 key，下拉框会长期停在旧数据上。
 *
 * 统一约定：queryKey 一律 `[<crud 前缀>, "options"]`。
 * `CrudPage` 的 `invalidateQueries({ queryKey: [prefix] })` 按前缀匹配，
 * 会连同选项缓存一起刷新，不需要各页面再手动补失效。
 */

import { useQuery } from "@tanstack/react-query";
import { appApi, menuApi, permApi, permGroupApi, realmApi, roleApi, roleGroupApi } from "./api";

/** 选项数据变动不频繁，5 分钟足够；真正的新增/改名靠前缀失效立即生效。 */
const OPTION_STALE = 5 * 60_000;

export const optionKeys = {
  app: ["/adm/app", "options"] as const,
  realm: ["/adm/realm", "options"] as const,
  menu: ["/adm/menu", "options"] as const,
  perm: ["/adm/perm", "options"] as const,
  role: ["/adm/role", "options"] as const,
  roleGroup: ["/adm/role-group", "options"] as const,
  permGroup: ["/adm/perm-group", "options"] as const,
};

/** 应用列表：侧栏分组、菜单归属、菜单授权清单共用。 */
export function useAppOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.app,
    queryFn: () => appApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/** 领域列表：用户/组织数据域归属与角色数据范围选择；应用、菜单、角色、权限不选领域。 */
export function useRealmOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.realm,
    queryFn: () => realmApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/** 菜单列表（按 treeCode 升序）：父节点选择、授权清单、路由兜底。 */
export function useMenuOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.menu,
    queryFn: () => menuApi.list({ _orderBy: "tree_code:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/** 权限点列表（按 sortOrder 升序）：角色授权抽屉。 */
export function usePermOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.perm,
    queryFn: () => permApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/** 角色列表（按 sortOrder 升序）：用户角色授权抽屉。 */
export function useRoleOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.role,
    queryFn: () => roleApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/** 角色分组列表（按 treeCode 升序）：角色归属、分组树。 */
export function useRoleGroupOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.roleGroup,
    queryFn: () => roleGroupApi.list({ _orderBy: "tree_code:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/** 权限分组列表（按 treeCode 升序）：权限归属、分组树。 */
export function usePermGroupOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.permGroup,
    queryFn: () => permGroupApi.list({ _orderBy: "tree_code:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

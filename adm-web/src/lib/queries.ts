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
import {
  appApi,
  menuApi,
  opTypeApi,
  orgApi,
  orgTypeApi,
  permApi,
  permGroupApi,
  personApi,
  personCodeTypeApi,
  realmApi,
  roleApi,
  roleGroupApi,
  userApi,
} from "./api";
import { shortId } from "./utils";

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
  opType: ["opType", "options"] as const,
  org: ["/adm/org", "options"] as const,
  orgType: ["/adm/org-type", "options"] as const,
  user: ["/adm/user", "options"] as const,
  person: ["/adm/person", "options"] as const,
  personCodeType: ["/adm/person-code-type", "options"] as const,
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

/** 领域列表：用户/组织数据域归属与角色领域可见范围选择；应用、菜单、角色、权限不选领域。 */
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

/** 操作类型字典（按 sortOrder 升序）：操作日志的类型列与筛选下拉共用。 */
export function useOpTypeOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.opType,
    queryFn: () => opTypeApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/** 组织树（按 treeCode 升序）：组织的父节点选择、成员归属、用户页的组织筛选共用。 */
export function useOrgOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.org,
    queryFn: () => orgApi.list({ _orderBy: "tree_code:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/** 组织类型字典：组织表单的分类下拉、组织类型页数量统计。 */
export function useOrgTypeOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.orgType,
    queryFn: () => orgTypeApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/**
 * 人员列表（按拼音首字母升序）：用户页的「人员档案」列与关联人员下拉共用。
 *
 * 注意：列表接口返回的是 `AdmPersonListVo`，姓名/手机/邮箱/身份证都是服务端
 * 等长遮蔽后的值（`张*`、`138****8000`），所以下拉标签要靠**工号**区分人，
 * 光看姓名分不清两个「张*」。要用原值只能走单条详情（编辑表单回显那条路）。
 */
export function usePersonOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.person,
    queryFn: () => personApi.list({ _orderBy: "name_pinyin_abbr:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/**
 * 用户列表（按登录名升序）：审计日志把 `user_id` 翻成登录名用。
 *
 * 日志表只存 userId，光看短 ID 无法回答「是谁删的」；这个 hook 只取 name 建映射，
 * 不做逐行请求。用户改名后靠 `["/adm/user"]` 前缀失效自动刷新。
 */
export function useUserOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.user,
    queryFn: () => userApi.list({ _orderBy: "name:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/** 人员编码类型字典：人员表单的工号 / 学号类型下拉。 */
export function usePersonCodeTypeOptions(enabled = true) {
  return useQuery({
    queryKey: optionKeys.personCodeType,
    queryFn: () => personCodeTypeApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: OPTION_STALE,
    retry: 0,
    enabled,
  });
}

/**
 * 日志页「用户」筛选的异步选项。
 * 日志表只存 userId，展示时统一走 id 缩写，不额外拼接用户详情。
 */export async function loadUserOptions(): Promise<{ value: string; label: string }[]> {
  const users = await userApi.list({ _orderBy: "name:asc" });
  return users.map((user) => ({
    value: user.id,
    label: `${user.name}（${shortId(user.id)}）`,
  }));
}

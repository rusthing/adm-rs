import { request, toQueryString } from "@/lib/http";
import type {
  AdmAppVo,
  AdmDashboardSaveInput,
  AdmDashboardVo,
  AdmDashboardWidgetVo,
  AdmLoginVo,
  AdmLogoutVo,
  AdmMeVo,
  AdmMenuVo,
  AdmOpTypeVo,
  AdmPermGroupVo,
  AdmPermVo,
  AdmRealmVo,
  AdmRoleGroupVo,
  AdmRoleMenuVo,
  AdmRolePermVo,
  AdmRoleUserVo,
  AdmRoleVo,
  AdmUserVo,
  AdmWidgetServiceVo,
  AdmWidgetTypeVo,
  PageQuery,
  PageRx,
  TreeDeletePreview,
} from "@/lib/types";

/** 业务接口要求 `Authorization: Bearer`；`X-User-Id` 由 http.ts 从会话里自动补，服务端中间件会覆盖成令牌里的用户。 */
type Payload = Record<string, unknown>;

export interface CrudApi<T> {
  prefix: string;
  page: (query?: PageQuery) => Promise<PageRx<T>>;
  /**
   * 检索分页：`{prefix}/search/page`，支持 Bean Searcher 字段运算符。
   * 用于带日期范围（`字段-op=bt`）等非等值条件的搜索行。
   */
  searchPage: (query?: PageQuery) => Promise<PageRx<T>>;
  list: (query?: PageQuery) => Promise<T[]>;
  get: (id: string) => Promise<T | undefined>;
  add: (body: Payload) => Promise<unknown>;
  modify: (body: Payload) => Promise<unknown>;
  save: (body: Payload) => Promise<unknown>;
  /** 与 `save` 只差一步：有 id 但记录不存在时按该 id 补建，而不是报错 */
  upsert: (body: Payload) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  /**
   * 树形删除预检：返回将级联删除的子孙数量、名单与引用阻塞原因。
   * 对应 `GET {prefix}/delete-preview/{id}`，仅树形实体提供。
   */
  deletePreview: (id: string) => Promise<TreeDeletePreview | undefined>;
  /**
   * 统一重排：提交同组完整 id 顺序，服务端整体重算为连续序号。
   * 对应 `POST {prefix}/reorder`，请求体为 `{ ids }`。
   */
  reorder: (ids: string[]) => Promise<unknown>;
}

/** 22 个宏生成接口里前端实际用到的 9 个（树形实体多一个删除预检）。 */
export function crudApi<T>(prefix: string): CrudApi<T> {
  return {
    prefix,
    page: async (query) => {
      const data = await request<PageRx<T>>(`${prefix}/page${toQueryString(query)}`);
      return data ?? { pageNum: "1", total: "0", list: [] };
    },
    searchPage: async (query) => {
      const data = await request<PageRx<T>>(`${prefix}/search/page${toQueryString(query)}`);
      return data ?? { pageNum: "1", total: "0", list: [] };
    },
    list: async (query) => (await request<T[]>(`${prefix}/list${toQueryString(query)}`)) ?? [],
    get: (id) => request<T>(`${prefix}/${encodeURIComponent(id)}`),
    add: (body) => request(`${prefix}`, { method: "POST", body }),
    modify: (body) => request(`${prefix}`, { method: "PUT", body }),
    save: (body) => request(`${prefix}/save`, { method: "POST", body }),
    upsert: (body) => request(`${prefix}/upsert`, { method: "POST", body }),
    remove: (id) => request(`${prefix}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    deletePreview: (id) =>
      request<TreeDeletePreview>(`${prefix}/delete-preview/${encodeURIComponent(id)}`),
    reorder: (ids) => request(`${prefix}/reorder`, { method: "POST", body: { ids } }),
  };
}

export const userApi = {
  ...crudApi<AdmUserVo>("/adm/user"),
  /** 把指定用户的登录口令重置为服务端配置的默认口令 */
  resetPassword: (id: string) =>
    request(`/adm/user/${encodeURIComponent(id)}/reset-password`, { method: "POST" }),
};
export const roleApi = crudApi<AdmRoleVo>("/adm/role");
export const roleGroupApi = crudApi<AdmRoleGroupVo>("/adm/role-group");
export const menuApi = crudApi<AdmMenuVo>("/adm/menu");
export const permApi = crudApi<AdmPermVo>("/adm/perm");
export const permGroupApi = crudApi<AdmPermGroupVo>("/adm/perm-group");
export const realmApi = crudApi<AdmRealmVo>("/adm/realm");
export const appApi = crudApi<AdmAppVo>("/adm/app");
export const opTypeApi = crudApi<AdmOpTypeVo>("/adm/op-type");
export const roleUserApi = crudApi<AdmRoleUserVo>("/adm/role-user");
export const roleMenuApi = crudApi<AdmRoleMenuVo>("/adm/role-menu");
export const rolePermApi = crudApi<AdmRolePermVo>("/adm/role-perm");

export interface LoginInput {
  account: string;
  /** 已做过一次 SM3 的 64 位小写十六进制 */
  loginPswd: string;
}

export async function login(input: LoginInput): Promise<AdmLoginVo> {
  const data = await request<AdmLoginVo>("/adm/auth/login", {
    method: "POST",
    body: input,
    userHeader: false,
  });
  if (!data) throw new Error("登录接口未返回令牌");
  return data;
}

export async function logout(): Promise<AdmLogoutVo | undefined> {
  return request<AdmLogoutVo>("/adm/auth/logout", { method: "POST", userHeader: false });
}

export interface ChangePasswordInput {
  /** 旧口令的一次摘要，64 位小写十六进制 */
  oldPswd: string;
  /** 新口令的一次摘要，64 位小写十六进制 */
  newPswd: string;
}

export const authApi = {
  /** 当前用户资料 + 角色 + 权限 + 可见菜单（真实 RBAC 聚合） */
  me: () => request<AdmMeVo>("/adm/auth/me"),
  /** 个人中心改密：不复用 PUT /adm/user */
  changePassword: (body: ChangePasswordInput) =>
    request("/adm/auth/change-password", { method: "POST", body }),
  /**
   * 高危操作前校验当前用户的审核口令。
   * 入参是明文口令的一次 SM3 摘要（64 位十六进制），失败按 `code` 区分原因。
   */
  verifyAuditPassword: (auditPswd: string) =>
    request("/adm/auth/verify-audit-password", { method: "POST", body: { auditPswd } }),
};

/**
 * 首页配置与 adm 域 widget 数据。
 *
 * adm-svr 只返回自己的配置与逻辑端点目录；跨服务数据由前端经 gatex
 * 并行直连各服务（见 `lib/widget-fetch.ts`）。配置里绝不出现 URL。
 */
export const dashboardApi = {
  /** 当前用户按角色优先级生效的首页配置 */
  effective: () => request<AdmDashboardVo | null>("/adm/dashboard/effective"),
  listConfigs: async () =>
    (await request<AdmDashboardVo[]>("/adm/dashboard/config/list")) ?? [],
  getConfig: (roleId?: string) =>
    request<AdmDashboardVo | null>(`/adm/dashboard/config${toQueryString({ roleId })}`),
  saveConfig: (body: AdmDashboardSaveInput) =>
    request<AdmDashboardVo>("/adm/dashboard/config", { method: "PUT", body }),
  deleteConfig: (roleId: string) =>
    request<boolean>(`/adm/dashboard/config${toQueryString({ roleId })}`, { method: "DELETE" }),
  widgetTypes: async () =>
    (await request<AdmWidgetTypeVo[]>("/adm/dashboard/widget-type")) ?? [],
  /** 逻辑 service/endpoint 目录；仅用于下拉与前端寻址，不含真实地址 */
  endpoints: async () =>
    (await request<AdmWidgetServiceVo[]>("/adm/dashboard/endpoints")) ?? [],
};

/** 供管理页在本地编辑时复用的控件类型。 */
export type DashboardWidgetDraft = AdmDashboardWidgetVo;

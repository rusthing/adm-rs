import { request, toQueryString } from "@/lib/http";
import type {
  AdmAppVo,
  AdmLoginLogVo,
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
  PageQuery,
  PageRx,
} from "@/lib/types";

/** 业务接口要求 `Authorization: Bearer`；`X-User-Id` 由 http.ts 从会话里自动补，服务端中间件会覆盖成令牌里的用户。 */
type Payload = Record<string, unknown>;

export interface CrudApi<T> {
  prefix: string;
  page: (query?: PageQuery) => Promise<PageRx<T>>;
  list: (query?: PageQuery) => Promise<T[]>;
  get: (id: string) => Promise<T | undefined>;
  add: (body: Payload) => Promise<unknown>;
  modify: (body: Payload) => Promise<unknown>;
  save: (body: Payload) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}

/** 21 个宏生成接口里前端实际用到的 7 个。 */
export function crudApi<T>(prefix: string): CrudApi<T> {
  return {
    prefix,
    page: async (query) => {
      const data = await request<PageRx<T>>(`${prefix}/page${toQueryString(query)}`);
      return data ?? { pageNum: "1", total: "0", list: [] };
    },
    list: async (query) => (await request<T[]>(`${prefix}/list${toQueryString(query)}`)) ?? [],
    get: (id) => request<T>(`${prefix}/${encodeURIComponent(id)}`),
    add: (body) => request(`${prefix}`, { method: "POST", body }),
    modify: (body) => request(`${prefix}`, { method: "PUT", body }),
    save: (body) => request(`${prefix}/save`, { method: "POST", body }),
    remove: (id) => request(`${prefix}/${encodeURIComponent(id)}`, { method: "DELETE" }),
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
export const loginLogApi = crudApi<AdmLoginLogVo>("/adm/login-log");
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
};

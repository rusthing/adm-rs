/** 与 adm-api 的序列化形态一一对应；所有 u64（ID / 毫秒）在 JSON 里都是字符串。 */

export type RoResult = 1 | -1 | -2 | -3;

export interface Ro<T = unknown> {
  result: RoResult;
  msg: string;
  timestamp: string;
  extra?: T;
  detail?: string;
  code?: string;
}

export interface PageRx<T> {
  pageNum: string;
  total: string;
  list: T[];
}

export type QueryValue = string | number | boolean | null | undefined;

export interface PageQuery {
  _page?: number;
  _size?: number;
  _keyword?: string;
  _orderBy?: string;
  [key: string]: QueryValue;
}

export interface AdmLoginVo {
  token: string;
  tokenType: string;
  expireMs: string;
  userId: string;
  name: string;
  nickName?: string;
  loginPswdDefault: boolean;
  loginLogId: string;
}

export interface AdmLogoutVo {
  logoutMs: string;
  loginLogId: string;
}

export interface AuditFields {
  createrId: string;
  createMs: string;
  updaterId: string;
  updateMs: string;
}

export interface AdmUserVo extends AuditFields {
  id: string;
  personId?: string;
  name: string;
  nickName?: string;
  mobile?: string;
  mobileVerified: boolean;
  email?: string;
  emailVerified: boolean;
  idCard?: string;
  realName?: string;
  realNameVerified: boolean;
  expireMs?: string;
  status: number;
  failCount: number;
  lockUntilMs?: string;
  lastLoginMs?: string;
  remark?: string;
  enabled: boolean;
}

export interface AdmRoleVo extends AuditFields {
  id: string;
  groupId: string;
  name: string;
  sortOrder: number;
  remark?: string;
  enabled: boolean;
}

export interface AdmRoleGroupVo extends AuditFields {
  id: string;
  realmId: string;
  treeCode: string;
  name: string;
  remark?: string;
  enabled: boolean;
}

export interface AdmPermGroupVo extends AuditFields {
  id: string;
  realmId: string;
  treeCode: string;
  name: string;
  remark?: string;
  enabled: boolean;
}

export interface AdmMenuVo extends AuditFields {
  id: string;
  appId: string;
  treeCode: string;
  code: string;
  name: string;
  path: string;
  component?: string;
  linkType: number;
  icon?: string;
  keepAlive: boolean;
  visible: boolean;
  remark?: string;
  enabled: boolean;
}

export interface AdmPermVo extends AuditFields {
  id: string;
  groupId: string;
  opTypeCode?: string;
  name: string;
  urn: string;
  sortOrder: number;
  remark?: string;
  enabled: boolean;
}

export interface AdmRealmVo extends AuditFields {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  remark?: string;
  enabled: boolean;
}

export interface AdmAppVo extends AuditFields {
  id: string;
  realmId?: string;
  code: string;
  name: string;
  sortOrder: number;
  remark?: string;
  enabled: boolean;
}

export interface AdmOpTypeVo extends AuditFields {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  remark?: string;
}

export interface AdmRoleUserVo extends AuditFields {
  id: string;
  userId: string;
  roleId: string;
}

export interface AdmRoleMenuVo extends AuditFields {
  id: string;
  menuId: string;
  roleId: string;
}

export interface AdmRolePermVo extends AuditFields {
  id: string;
  roleId: string;
  permId: string;
}

export interface AdmLoginLogVo extends AuditFields {
  id: string;
  userId?: string;
  loginMs: string;
  logoutMs?: string;
  loginIp: string;
}

export interface AdmLockLogVo extends AuditFields {
  id: string;
  userId: string;
  lockMs: string;
  lockUntilMs: string;
  reason?: string;
}

/** 登录后落 localStorage 的会话；expireMs 是后端令牌到期时间。 */
export interface AuthSession {
  token: string;
  tokenType: string;
  expireMs: string;
  userId: string;
  name: string;
  nickName?: string;
  loginPswdDefault: boolean;
  loginLogId: string;
}

/** `GET /adm/auth/me` 的响应体：当前用户 + 角色 + 权限 + 可见菜单。 */
export interface AdmMeVo {
  user: AdmUserVo;
  roles: AdmRoleVo[];
  perms: AdmPermVo[];
  menus: AdmMenuVo[];
  permUrns: string[];
  /** 角色数据范围；本轮只下发，不做强制过滤 */
  scopes: AdmRoleScopeVo[];
  /** 当前生效的首页配置 */
  dashboard?: AdmDashboardVo;
}

/** 角色数据范围（`adm_role_scope`）。 */
export interface AdmRoleScopeVo {
  id: string;
  roleId: string;
  roleName?: string;
  realmId?: string;
  orgId?: string;
  scopeType: string;
}

/** 首页配置里的一条 widget 明细。 */
export interface AdmDashboardWidgetVo {
  id: string;
  dashboardId: string;
  widgetType: string;
  title: string;
  /** 逻辑服务键，如 `adm`；真实地址在服务端注册表 */
  service: string;
  /** 逻辑端点键，如 `stats.count` */
  endpoint: string;
  params?: Record<string, unknown>;
  permUrn?: string;
  scopeAware: boolean;
  sortOrder: number;
  enabled: boolean;
}

/** 一份角色级（或全局）首页配置。 */
export interface AdmDashboardVo {
  id: string;
  roleId?: string;
  roleName?: string;
  name: string;
  remark?: string;
  enabled: boolean;
  /** `role` / `global` / `preview` */
  source: string;
  widgets: AdmDashboardWidgetVo[];
  scopeAware: boolean;
}

/**
 * 各服务按同一契约返回的 widget 数据信封。
 *
 * 前端只渲染这个结构，不感知数据来自哪个服务；`status` 非 `ok` 时卡片
 * 显示「暂不可用」，不影响其它 widget，也不隐藏卡片。
 */
export interface AdmWidgetDataVo {
  widgetType: string;
  title: string;
  status: "ok" | "disabled" | "forbidden" | "error";
  data?: unknown;
  error?: string;
  generatedMs: string;
}

/**
 * 首页卡片的视图模型 = 配置里的展示信息 + 服务返回的信封。
 *
 * `loading` 是前端本地状态；卡片先占位再填充，避免布局跳动。
 */
export interface DashboardWidgetView {
  key: string;
  widgetType: string;
  title: string;
  scopeAware: boolean;
  sortOrder: number;
  status: "loading" | "ok" | "disabled" | "forbidden" | "error";
  data?: unknown;
  error?: string;
  generatedMs?: string;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface TodoItem {
  code: string;
  label: string;
  count: number;
  path?: string;
  severity: string;
}

export interface RecentLogItem {
  id: string | number;
  userId?: string;
  userName?: string;
  timeMs: string | number;
  ip?: string;
  title?: string;
  urn?: string;
}

/** widget 类型目录（管理页下拉用）。 */
export interface AdmWidgetTypeVo extends AuditFields {
  id: string;
  code: string;
  name: string;
  defaultService: string;
  defaultEndpoint: string;
  description?: string;
  defaultParams?: Record<string, unknown>;
  defaultPermUrn?: string;
  defaultScopeAware: boolean;
  sortOrder: number;
  enabled: boolean;
}

/** widget 逻辑端点目录项；不含 URL / 凭据 / 健康状态。 */
export interface AdmWidgetEndpointVo {
  key: string;
  name: string;
  method: string;
  paramsHint?: string;
  enabled: boolean;
  note?: string;
}

/** 逻辑服务与其端点；地址由 gatex 按服务名解析。 */
export interface AdmWidgetServiceVo {
  code: string;
  name: string;
  enabled: boolean;
  note?: string;
  endpoints: AdmWidgetEndpointVo[];
}

/** 保存首页配置的请求体。 */
export interface AdmDashboardSaveInput {
  roleId?: string;
  name: string;
  remark?: string;
  enabled: boolean;
  widgets: Array<Omit<AdmDashboardWidgetVo, "id" | "dashboardId" | "sortOrder">>;
}

/**
 * 前端侧的鉴权视图，完全来自后端 `GET /adm/auth/me`。
 *
 * 后端已按 role-user / role-menu / role-perm 过滤：`menus` 只含当前用户
 * 可见的菜单，`permUrns` 只含已授权且启用的权限。
 */
export interface Authz {
  userId: string;
  roles: AdmRoleVo[];
  perms: AdmPermVo[];
  menus: AdmMenuVo[];
  /** 权限 URN，形如 `GET:/adm/user` */
  permUrns: string[];
  /** 角色数据范围；本轮只展示，不做强制过滤 */
  scopes: AdmRoleScopeVo[];
  /** 当前生效的首页配置 */
  dashboard?: AdmDashboardVo;
  loadedAt: string;
}

export type FormValues = Record<string, string | boolean | number | undefined>;

import type { ComponentType } from "react";
import { AppsPage } from "@/pages/AppsPage";
import { DashboardConfigPage } from "@/pages/DashboardConfigPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LockLogsPage } from "@/pages/LockLogsPage";
import { LoginLogsPage } from "@/pages/LoginLogsPage";
import { MenusPage } from "@/pages/MenusPage";
import { OpLogsPage } from "@/pages/OpLogsPage";
import { OrgTypesPage } from "@/pages/OrgTypesPage";
import { OrgsPage } from "@/pages/OrgsPage";
import { PermissionGroupsPage } from "@/pages/PermissionGroupsPage";
import { PermissionsPage } from "@/pages/PermissionsPage";
import { PersonCodeTypesPage } from "@/pages/PersonCodeTypesPage";
import { PersonsPage } from "@/pages/PersonsPage";
import { RealmsPage } from "@/pages/RealmsPage";
import { RoleGroupsPage } from "@/pages/RoleGroupsPage";
import { RolesPage } from "@/pages/RolesPage";
import { UsersPage } from "@/pages/UsersPage";

/**
 * 菜单 `component` → 前端页面组件。
 *
 * - 这里是唯一登记处：路由（App.tsx）与侧栏（layout/nav.ts）共用。
 * - 未登记的 component 不会出现在侧栏；直接访问 URL 时仍由 App 渲染
 *   `UnregisteredPage` 占位，便于排查菜单配置。
 */
export const PAGE_COMPONENTS: Record<string, ComponentType> = {
  dashboard: DashboardPage,
  "dashboard-config": DashboardConfigPage,
  users: UsersPage,
  orgs: OrgsPage,
  "org-types": OrgTypesPage,
  persons: PersonsPage,
  "person-code-types": PersonCodeTypesPage,
  roles: RolesPage,
  menus: MenusPage,
  permissions: PermissionsPage,
  "role-groups": RoleGroupsPage,
  "permission-groups": PermissionGroupsPage,
  realms: RealmsPage,
  apps: AppsPage,
  "login-logs": LoginLogsPage,
  "op-logs": OpLogsPage,
  "lock-logs": LockLogsPage,
};

/** 页面级权限前缀；后端菜单已经按角色过滤过，这里再做一层界面兜底。 */
export const PAGE_PERMS: Record<string, string> = {
  users: "GET:/adm/user",
  orgs: "GET:/adm/org",
  "org-types": "GET:/adm/org-type",
  persons: "GET:/adm/person",
  "person-code-types": "GET:/adm/person-code-type",
  "dashboard-config": "GET:/adm/dashboard/config",
  roles: "GET:/adm/role",
  menus: "GET:/adm/menu",
  permissions: "GET:/adm/perm",
  "role-groups": "GET:/adm/role-group",
  "permission-groups": "GET:/adm/perm-group",
  realms: "GET:/adm/realm",
  apps: "GET:/adm/app",
  "login-logs": "GET:/adm/login-log",
  "op-logs": "GET:/adm/op-log",
  "lock-logs": "GET:/adm/lock-log",
};

/** 组件是否已注册；空 component（目录节点）不算。 */
export function isRegisteredComponent(component: string | undefined): boolean {
  return Boolean(component && PAGE_COMPONENTS[component]);
}

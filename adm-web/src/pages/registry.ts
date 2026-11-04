import type { ComponentType } from "react";
import { AppsPage } from "@/pages/AppsPage";
import { DashboardConfigPage } from "@/pages/DashboardConfigPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginLogsPage } from "@/pages/LoginLogsPage";
import { MenusPage } from "@/pages/MenusPage";
import { PermissionGroupsPage } from "@/pages/PermissionGroupsPage";
import { PermissionsPage } from "@/pages/PermissionsPage";
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
  roles: RolesPage,
  menus: MenusPage,
  permissions: PermissionsPage,
  "role-groups": RoleGroupsPage,
  "permission-groups": PermissionGroupsPage,
  realms: RealmsPage,
  apps: AppsPage,
  "login-logs": LoginLogsPage,
};

/** 页面级权限前缀；后端菜单已经按角色过滤过，这里再做一层界面兜底。 */
export const PAGE_PERMS: Record<string, string> = {
  users: "GET:/adm/user",
  "dashboard-config": "GET:/adm/dashboard/config",
  roles: "GET:/adm/role",
  menus: "GET:/adm/menu",
  permissions: "GET:/adm/perm",
  "role-groups": "GET:/adm/role-group",
  "permission-groups": "GET:/adm/perm-group",
  realms: "GET:/adm/realm",
  apps: "GET:/adm/app",
  "login-logs": "GET:/adm/login-log",
};

/** 组件是否已注册；空 component（目录节点）不算。 */
export function isRegisteredComponent(component: string | undefined): boolean {
  return Boolean(component && PAGE_COMPONENTS[component]);
}

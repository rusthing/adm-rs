import type { ComponentType, ReactNode } from "react";
import { createElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { RequireAuth, RequirePerm } from "@/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DashboardConfigPage } from "@/pages/DashboardConfigPage";
import { UsersPage } from "@/pages/UsersPage";
import { RolesPage } from "@/pages/RolesPage";
import { RoleGroupsPage } from "@/pages/RoleGroupsPage";
import { MenusPage } from "@/pages/MenusPage";
import { PermissionsPage } from "@/pages/PermissionsPage";
import { PermissionGroupsPage } from "@/pages/PermissionGroupsPage";
import { RealmsPage } from "@/pages/RealmsPage";
import { AppsPage } from "@/pages/AppsPage";
import { LoginLogsPage } from "@/pages/LoginLogsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { Badge, Button, EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import type { AdmMenuVo } from "@/lib/types";
import { Puzzle } from "lucide-react";

/**
 * 菜单 `component` → 前端页面组件。
 *
 * 后端菜单里 `component` 为空表示目录；这里没登记的 component 会走
 * `UnregisteredPage` 降级页，只影响该菜单项，不会让整个应用崩溃。
 */
const PAGE_COMPONENTS: Record<string, ComponentType> = {
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
const PAGE_PERMS: Record<string, string> = {
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

function UnregisteredPage({ menu }: { menu: AdmMenuVo }) {
  return (
    <div>
      <PageHeader
        title={menu.name}
        subtitle={`菜单路径 ${menu.path}；后端下发的 component 为 ${menu.component ?? "（空）"}。`}
        actions={<Badge tone="warn">未注册组件</Badge>}
      />
      <Panel title="前端未注册该页面" description="菜单来自后端，但组件映射缺失。">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
            <Puzzle size={22} />
          </div>
          <p className="max-w-md text-[12.5px] leading-relaxed text-muted">
            <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[11.5px] text-ink-soft">
              component = {menu.component ?? "null"}
            </code>
            在 `App.tsx` 的 `PAGE_COMPONENTS` 里没有对应条目。补齐映射后刷新即可；
            当前只降级这一页，其余菜单与功能不受影响。
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            刷新页面
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function NoMenuPage() {
  return (
    <EmptyState
      title="没有可见菜单"
      description="当前账号没有分配任何可见菜单或菜单尚未启用。请联系管理员在「角色 → 菜单授权」里配置。"
    />
  );
}

function LoginRoute() {
  const { session } = useAuth();
  return session ? <Navigate to="/" replace /> : <LoginPage />;
}

function Guarded({ perm, children }: { perm: string; children: ReactNode }) {
  return <RequirePerm perm={perm}>{children}</RequirePerm>;
}

function renderMenu(menu: AdmMenuVo) {
  const component = menu.component ? PAGE_COMPONENTS[menu.component] : undefined;
  if (!component) return <UnregisteredPage menu={menu} />;
  const page = createElement(component);
  const perm = menu.component ? PAGE_PERMS[menu.component] : undefined;
  return perm ? <Guarded perm={perm}>{page}</Guarded> : page;
}

export function App() {
  const { authz } = useAuth();

  // 侧栏、面包屑与路由都以后端菜单为准；外链菜单不注册前端路由
  const leafPaths = new Map<string, AdmMenuVo>();
  for (const menu of authz?.menus ?? []) {
    if (!menu.component || menu.linkType !== 1) continue;
    const path = menu.path.startsWith("/") ? menu.path.slice(1) : menu.path;
    if (path) leafPaths.set(path, menu);
  }

  const defaultPath =
    [...leafPaths.values()]
      .map((menu) => menu.path)
      .find((path) => path && path !== "/") ?? null;

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={defaultPath ? <Navigate to={defaultPath} replace /> : <NoMenuPage />} />
        {[...leafPaths.entries()].map(([path, menu]) => (
          <Route key={menu.id} path={path} element={renderMenu(menu)} />
        ))}
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

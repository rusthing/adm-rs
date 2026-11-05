import type { ReactNode } from "react";
import { createElement, useMemo } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { RequireAuth, RequirePerm } from "@/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PAGE_COMPONENTS, PAGE_PERMS, isRegisteredComponent } from "@/pages/registry";
import { Badge, Button, EmptyState, PageHeader, Panel, Spinner } from "@/components/ui/primitives";
import type { AdmMenuVo } from "@/lib/types";
import { useAppOptions } from "@/lib/queries";
import { Puzzle } from "lucide-react";

/**
 * 菜单 `component` → 前端页面组件，登记处见 `pages/registry.ts`。
 *
 * 侧栏只展示已登记组件的内链菜单；这里仍为未登记的 component 保留
 * `UnregisteredPage` 占位，直接访问 URL 时能看出是菜单配置问题。
 */

function UnregisteredPage({ menu }: { menu: AdmMenuVo }) {
  return (
    <div>
      <PageHeader
        title={menu.name}
        subtitle="这条菜单指向的页面在当前前端版本里尚未开放。"
        actions={<Badge tone="warn">未登记页面</Badge>}
      />
      <Panel title="页面暂不可用" description="这条菜单指向的页面没有在当前前端版本里登记。">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
            <Puzzle size={22} />
          </div>
          <p className="max-w-md text-[12.5px] leading-relaxed text-muted">
            请让管理员核对菜单的组件配置，或升级到包含该页面的前端版本。
            该入口不会出现在侧栏，其余菜单与功能不受影响。
          </p>
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-sunken"
          >
            回到工作台
          </Link>
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

/** 首次登录/刷新后权限还没返回，避免直接落进 404。 */
function AuthzPendingPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Spinner />
      <p className="text-[12.5px] text-muted">正在加载账号菜单与权限…</p>
    </div>
  );
}

/** 权限加载失败且没有缓存时给出可重试的具体原因，而不是伪装成 404 或空菜单。 */
function AuthzErrorPage({ message, onRetry }: { message?: string | null; onRetry: () => void }) {
  return (
    <EmptyState
      title="账号权限加载失败"
      description={
        message
          ? `无法读取账号权限信息：${message}。页面与菜单暂时不可用，可重试或重新登录。`
          : "无法读取账号权限信息，页面与菜单暂时不可用，可重试或重新登录。"
      }
      action={
        <Button variant="secondary" onClick={onRetry}>
          重新加载
        </Button>
      }
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
  const { authz, authzError, authzLoading, refreshAuthz } = useAuth();

  // 应用的 sort_order 决定侧栏分段顺序；默认落地页必须跟着同一顺序走，
  // 否则多应用时「先进哪个应用」与侧栏第一段不一致，用户会以为进错了应用。
  const appsQuery = useAppOptions(Boolean(authz?.menus?.length));
  const appRank = useMemo(() => {
    const rank = new Map<string, number>();
    (appsQuery.data ?? []).forEach((app, index) => rank.set(app.id, index));
    return rank;
  }, [appsQuery.data]);

  // 路由以后端菜单为准：外链 / 停用菜单不注册，且同一路径只保留一条。
  // 多应用完全可能配置出相同 path，Map 按 path 覆盖会让菜单静默丢失；
  // 这里按应用顺序 + treeCode 稳定排序后去重，结果可复现。
  const menuRoutes = useMemo(() => {
    const seen = new Set<string>();
    const routes: Array<{ path: string; menu: AdmMenuVo }> = [];
    const rankOf = (appId: string) => appRank.get(appId) ?? Number.MAX_SAFE_INTEGER;
    const sorted = [...(authz?.menus ?? [])].sort(
      (a, b) =>
        rankOf(a.appId) - rankOf(b.appId) ||
        a.appId.localeCompare(b.appId) ||
        a.treeCode.localeCompare(b.treeCode) ||
        a.id.localeCompare(b.id),
    );
    for (const menu of sorted) {
      if (!menu.component || menu.linkType !== 1 || menu.enabled === false) continue;
      const path = menu.path.startsWith("/") ? menu.path.slice(1) : menu.path;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      routes.push({ path, menu });
    }
    return routes;
  }, [authz?.menus, appRank]);

  // 默认页只落到已登记组件，避免首页跳到占位页；排序同上，结果稳定。
  const defaultPath =
    menuRoutes
      .filter(({ menu }) => isRegisteredComponent(menu.component))
      .map(({ menu }) => menu.path)
      .find((path) => path && path !== "/") ?? null;

  // 权限未返回或失败且无缓存时，直接访问任意深链都不应显示 404。
  // 应用顺序还在加载时也不跳默认页，否则会先落到字典序第一个应用再跳走。
  const appsPending = Boolean(authz?.menus?.length) && appsQuery.isLoading;
  const pendingFallback = (authzLoading && !authz) || appsPending;
  const errorFallback = Boolean(authzError) && !authz;

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
        <Route
          index
          element={
            pendingFallback ? (
              <AuthzPendingPage />
            ) : errorFallback ? (
              <AuthzErrorPage message={authzError} onRetry={refreshAuthz} />
            ) : defaultPath ? (
              <Navigate to={defaultPath} replace />
            ) : (
              <NoMenuPage />
            )
          }
        />
        {menuRoutes.map(({ path, menu }) => (
          <Route key={menu.id} path={path} element={renderMenu(menu)} />
        ))}
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="*"
          element={
            pendingFallback ? (
              <AuthzPendingPage />
            ) : errorFallback ? (
              <AuthzErrorPage message={authzError} onRetry={refreshAuthz} />
            ) : (
              <NotFoundPage />
            )
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

import type { ReactNode } from "react";
import { createElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { RequireAuth, RequirePerm } from "@/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PAGE_COMPONENTS, PAGE_PERMS, isRegisteredComponent } from "@/pages/registry";
import { Badge, Button, EmptyState, PageHeader, Panel, Spinner } from "@/components/ui/primitives";
import type { AdmMenuVo } from "@/lib/types";
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
            在 `pages/registry.ts` 的 `PAGE_COMPONENTS` 里没有对应条目。补齐映射后刷新即可；
            该入口不会出现在侧栏，当前只降级这一页，其余菜单与功能不受影响。
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

/** 首次登录/刷新后 `/me` 还没返回，避免直接落进 404。 */
function AuthzPendingPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Spinner />
      <p className="text-[12.5px] text-muted">正在加载账号菜单与权限…</p>
    </div>
  );
}

/** `/me` 失败且没有缓存时给出可重试的具体原因，而不是伪装成 404 或空菜单。 */
function AuthzErrorPage({ message, onRetry }: { message?: string | null; onRetry: () => void }) {
  return (
    <EmptyState
      title="账号权限加载失败"
      description={
        message
          ? `无法读取 /adm/auth/me：${message}。页面与菜单暂时不可用，可重试或重新登录。`
          : "无法读取 /adm/auth/me，页面与菜单暂时不可用，可重试或重新登录。"
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

  // 侧栏、面包屑与路由都以后端菜单为准；外链菜单不注册前端路由
  const leafPaths = new Map<string, AdmMenuVo>();
  for (const menu of authz?.menus ?? []) {
    if (!menu.component || menu.linkType !== 1) continue;
    const path = menu.path.startsWith("/") ? menu.path.slice(1) : menu.path;
    if (path) leafPaths.set(path, menu);
  }

  // 默认页按菜单编码稳定排序，且只落到已注册组件，避免首页跳到占位页。
  const defaultPath =
    [...leafPaths.values()]
      .sort((a, b) => a.treeCode.localeCompare(b.treeCode))
      .filter((menu) => isRegisteredComponent(menu.component))
      .map((menu) => menu.path)
      .find((path) => path && path !== "/") ?? null;

  // `/me` 未返回或失败且无缓存时，直接访问任意深链都不应显示 404。
  const pendingFallback = authzLoading && !authz;
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
        {[...leafPaths.entries()].map(([path, menu]) => (
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

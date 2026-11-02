import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { buildNav, findNav } from "@/components/layout/nav";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight, ExternalLink, LoaderCircle, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";

export function AppShell() {
  const { session, authz, authzError, authzLoading, logout, refreshAuthz } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const groups = useMemo(() => buildNav(authz?.menus ?? []), [authz?.menus]);
  const matched = findNav(groups, location.pathname);
  const roleNames = authz?.roles.map((role) => role.name) ?? [];

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-ink/35 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[238px] flex-col border-r border-line bg-surface transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-[58px] items-center gap-2.5 border-b border-line px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold leading-tight text-ink">Adm Console</div>
            <div className="text-[10.5px] leading-tight text-muted">账号 · 角色 · 权限</div>
          </div>
          <button
            type="button"
            className="text-muted hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="关闭菜单"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {groups.length === 0 ? (
            <div className="px-2 py-3 text-[11.5px] leading-relaxed text-muted">
              当前账号没有可见菜单。
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-4">
                <div className="px-2 pb-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted/80">
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = matched?.item.id === item.id;
                    const Icon = item.icon;
                    const className = cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors",
                      active
                        ? "bg-accent-soft text-accent-strong"
                        : "text-ink-soft hover:bg-sunken hover:text-ink",
                    );
                    const inner = (
                      <>
                        <Icon size={15} className={active ? "text-accent" : "text-muted"} />
                        <span className="truncate">{item.label}</span>
                        {item.external && <ExternalLink size={12} className="text-muted" />}
                        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
                      </>
                    );
                    return item.external ? (
                      <a
                        key={item.id}
                        href={item.path}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setMobileOpen(false)}
                        className={className}
                      >
                        {inner}
                      </a>
                    ) : (
                      <Link
                        key={item.id}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={className}
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </nav>

        <div className="border-t border-line px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sunken text-[11px] font-semibold text-accent-strong">
              {(session?.nickName || session?.name || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-ink">{session?.nickName || session?.name}</div>
              <div className="truncate text-[10.5px] text-muted">
                {roleNames.length > 0 ? roleNames.join(" · ") : "未分配角色"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="rounded-md p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
              title="退出登录"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[238px]">
        <header className="sticky top-0 z-30 flex h-[58px] items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
          <button
            type="button"
            className="rounded-md border border-line p-1.5 text-muted hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="打开菜单"
          >
            <Menu size={16} />
          </button>

          <div className="min-w-0 flex-1">
            {matched ? (
              <nav className="flex items-center gap-1.5 text-[12px] text-muted">
                <span>{matched.group.label}</span>
                <ChevronRight size={12} />
                <span className="font-medium text-ink">{matched.item.label}</span>
              </nav>
            ) : (
              <div className="text-[12px] text-muted">Adm Console</div>
            )}
          </div>

          {authzLoading && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <LoaderCircle size={13} className="animate-spin" /> 权限加载
            </span>
          )}
          {roleNames.length > 0 && <Badge tone="neutral">{roleNames.length} 个角色</Badge>}
          {session?.loginPswdDefault && <Badge tone="warn">初始口令</Badge>}
          <div className="hidden items-center gap-2 sm:flex">
            <Link
              to="/profile"
              className="text-[12px] text-muted hover:text-ink"
            >
              {session?.nickName || session?.name}
            </Link>
          </div>
        </header>

        {session?.loginPswdDefault && (
          <div className="border-b border-warn/30 bg-warn-soft px-4 py-2 text-[12px] text-warn">
            当前账号仍在使用初始口令。生产环境应先到
            <Link to="/profile" className="mx-1 underline underline-offset-2">
              个人中心
            </Link>
            修改。个人中心使用独立改密接口 <code className="font-mono">POST /adm/auth/change-password</code>。
          </div>
        )}

        {authzError && (
          <div className="flex flex-wrap items-center gap-2 border-b border-danger/25 bg-danger-soft px-4 py-2 text-[12px] text-danger">
            <AlertTriangle size={14} />
            权限信息加载失败：{authzError}。当前只显示无需权限的页面。
            <Button size="sm" variant="ghost" onClick={() => void refreshAuthz()}>
              重试
            </Button>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6">
          <Outlet />
        </main>

        <footer className="mx-auto flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-2 px-4 pb-6 text-[11px] text-muted sm:px-6">
          <span>Adm Console · 前端视图与 adm-svr REST 契约对齐</span>
          <span className="font-mono">API {import.meta.env.VITE_API_BASE || "同源"}</span>
        </footer>
      </div>
    </div>
  );
}

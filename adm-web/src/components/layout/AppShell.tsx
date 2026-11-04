import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { buildNav, findNav } from "@/components/layout/nav";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserCircle,
  X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";

/** 桌面侧栏折叠状态；只影响 ≥ lg，移动端始终是抽屉 */
const COLLAPSE_KEY = "adm.shell.collapsed";
const COLLAPSED_WIDTH = 64;

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

const MENU_ITEM_CLASS =
  "flex items-center gap-2 px-3 py-2 text-[12.5px] text-ink-soft transition-colors hover:bg-sunken hover:text-ink";

/** 顶栏右上角账号菜单：头像 / 账号名 / 角色名 + 下拉操作 */
function AccountMenu({
  name,
  roleText,
  onLogout,
}: {
  name: string;
  roleText: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-transparent py-1 pl-1 pr-1.5 text-left transition-colors hover:bg-sunken",
          open && "bg-sunken",
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block max-w-[112px] truncate text-[12.5px] font-medium leading-tight text-ink sm:max-w-[150px]">
            {name}
          </span>
          {/* 空间不足时只隐藏角色名，账号名保留 */}
          <span className="mt-0.5 hidden max-w-[150px] truncate text-[10.5px] leading-tight text-muted sm:block">
            {roleText}
          </span>
        </span>
        <ChevronDown size={14} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-[190px] overflow-hidden rounded-[12px] border border-line bg-surface py-1 shadow-panel"
        >
          <Link to="/profile" role="menuitem" className={MENU_ITEM_CLASS} onClick={() => setOpen(false)}>
            <UserCircle size={14} className="text-muted" /> 个人中心
          </Link>
          <Link to="/profile" role="menuitem" className={MENU_ITEM_CLASS} onClick={() => setOpen(false)}>
            <KeyRound size={14} className="text-muted" /> 修改口令
          </Link>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className={cn(
              MENU_ITEM_CLASS,
              "w-full text-danger hover:bg-danger-soft hover:text-danger",
            )}
          >
            <LogOut size={14} /> 退出登录
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { session, authz, authzError, authzLoading, logout, refreshAuthz } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [tooltip, setTooltip] = useState<{ label: string; group: string; top: number } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const groups = useMemo(() => buildNav(authz?.menus ?? []), [authz?.menus]);
  const matched = findNav(groups, location.pathname);
  const roleNames = authz?.roles.map((role) => role.name) ?? [];

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* 隐私模式 / 存储禁用时忽略 */
    }
    setTooltip(null);
  }, [collapsed]);

  const showTooltip = (label: string, group: string, element: HTMLElement) => {
    if (!collapsed) return;
    const rect = element.getBoundingClientRect();
    setTooltip({ label, group, top: rect.top + rect.height / 2 });
  };

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
          "fixed inset-y-0 left-0 z-50 flex w-[238px] flex-col border-r border-line bg-surface transition-transform lg:translate-x-0 lg:transition-[width] lg:duration-200 lg:ease-out",
          collapsed ? "lg:w-[64px]" : "lg:w-[238px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex h-[58px] items-center gap-2.5 border-b border-line px-4",
            collapsed && "lg:justify-center lg:gap-0 lg:px-0",
          )}
        >
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white", collapsed && "lg:hidden")}>
            <ShieldCheck size={16} />
          </div>
          <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
            <div className="text-[13.5px] font-semibold leading-tight text-ink">Adm Console</div>
            <div className="text-[10.5px] leading-tight text-muted">账号 · 角色 · 权限</div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
            aria-expanded={!collapsed}
            title={collapsed ? "展开侧栏" : "收起侧栏"}
            className={cn(
              "ml-auto hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink lg:inline-flex",
              collapsed && "lg:ml-0 lg:h-10 lg:w-10",
            )}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="关闭菜单"
          >
            <X size={16} />
          </button>
        </div>

        <nav className={cn("flex-1 overflow-y-auto px-2.5 py-3", collapsed && "lg:px-2")}>
          {groups.length === 0 ? (
            <div className={cn("px-2 py-3 text-[11.5px] leading-relaxed text-muted", collapsed && "lg:hidden")}>
              当前账号没有可见菜单。
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className={cn("mb-4", collapsed && "lg:mb-2")}>
                <div
                  className={cn(
                    "px-2 pb-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted/80",
                    collapsed && "lg:hidden",
                  )}
                >
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = matched?.item.id === item.id;
                    const Icon = item.icon;
                    const className = cn(
                      "relative flex min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors",
                      active
                        ? "bg-accent-soft text-accent-strong"
                        : "text-ink-soft hover:bg-sunken hover:text-ink",
                      collapsed && "lg:h-10 lg:justify-center lg:gap-0 lg:px-0 lg:py-0",
                    );
                    const interactionProps: ComponentProps<"a"> = collapsed
                      ? {
                          "aria-label": item.label,
                          onMouseEnter: (event) =>
                            showTooltip(item.label, group.label, event.currentTarget),
                          onMouseLeave: () => setTooltip(null),
                          onFocus: (event) => showTooltip(item.label, group.label, event.currentTarget),
                          onBlur: () => setTooltip(null),
                        }
                      : {};
                    const inner = (
                      <>
                        <Icon size={15} className={active ? "text-accent" : "text-muted"} />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                        {item.external && (
                          <ExternalLink size={12} className={cn("text-muted", collapsed && "lg:hidden")} />
                        )}
                        {active && (
                          <span
                            className={cn(
                              "ml-auto h-1.5 w-1.5 rounded-full bg-accent",
                              collapsed && "lg:hidden",
                            )}
                          />
                        )}
                        {/* 折叠态选中项：左侧强调条 */}
                        {active && collapsed && (
                          <span className="absolute left-0 top-1/2 hidden h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent lg:block" />
                        )}
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
                        aria-current={active ? "page" : undefined}
                        {...interactionProps}
                      >
                        {inner}
                      </a>
                    ) : (
                      <Link
                        key={item.id}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={className}
                        aria-current={active ? "page" : undefined}
                        {...interactionProps}
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

        <div className={cn("border-t border-line px-3 py-3", collapsed && "lg:px-2")}>
          <div
            className={cn(
              "flex items-center justify-between gap-2 text-[10.5px] text-muted",
              collapsed && "lg:justify-center",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", import.meta.env.DEV ? "bg-warn" : "bg-success")} />
              <span className={cn(collapsed && "lg:hidden")}>
                {import.meta.env.DEV ? "开发环境" : "生产环境"}
              </span>
            </span>
            <span className={cn("font-mono", collapsed && "lg:hidden")}>adm-web</span>
          </div>
          {/* 移动端抽屉里也能进入个人中心 / 退出 */}
          <div className="mt-2.5 flex gap-1.5 lg:hidden">
            <Link
              to="/profile"
              onClick={() => setMobileOpen(false)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[11.5px] text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
            >
              <UserCircle size={13} /> 个人中心
            </Link>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                void onLogout();
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[11.5px] text-danger transition-colors hover:bg-danger-soft"
            >
              <LogOut size={13} /> 退出登录
            </button>
          </div>
        </div>
      </aside>

      {collapsed && tooltip && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] hidden -translate-y-1/2 rounded-md border border-line bg-surface px-2 py-1 shadow-panel lg:block"
          style={{ top: tooltip.top, left: COLLAPSED_WIDTH + 8 }}
        >
          <div className="whitespace-nowrap text-[11.5px] font-medium text-ink">{tooltip.label}</div>
          <div className="whitespace-nowrap text-[10px] text-muted">{tooltip.group}</div>
        </div>
      )}

      <div
        className={cn(
          "transition-[padding] duration-200",
          collapsed ? "lg:pl-[64px]" : "lg:pl-[238px]",
        )}
      >
        <header className="sticky top-0 z-30 flex h-[58px] items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted hover:text-ink lg:hidden"
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
            ) : location.pathname === "/profile" ? (
              <nav className="flex items-center gap-1.5 text-[12px] text-muted">
                <span>账号</span>
                <ChevronRight size={12} />
                <span className="font-medium text-ink">个人中心</span>
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
          {roleNames.length > 0 && (
            <div className="hidden md:block">
              <Badge tone="neutral">{roleNames.length} 个角色</Badge>
            </div>
          )}
          {session?.loginPswdDefault && (
            <div className="hidden sm:block">
              <Badge tone="warn">初始口令</Badge>
            </div>
          )}
          <AccountMenu
            name={session?.nickName || session?.name || "未登录"}
            roleText={roleNames.length > 0 ? roleNames.join(" · ") : "未分配角色"}
            onLogout={() => void onLogout()}
          />
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
            权限信息加载失败：{authzError}。
            {authz ? "当前沿用上次缓存的菜单与权限，刷新成功后自动更新。" : "菜单与页面暂不可用，可重试或重新登录。"}
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

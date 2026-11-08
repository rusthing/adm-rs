import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { buildNavSections, findNavTrail, sectionNodes } from "@/components/layout/nav";
import type { NavNode, NavSection } from "@/components/layout/nav";
import { useAppOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  AppWindow,
  ChevronDown,
  ChevronRight,
  ExternalLink,
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
            <UserCircle size={14} className="text-muted" /> 个人中心 / 修改口令
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

/**
 * 多应用时的分组头。折叠态只留一个图标作分隔，避免 64px 侧栏里挤出文字。
 * 是否渲染由 `buildNavSections()` 按「可见菜单里的应用数」动态决定。
 */
function AppSectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  return (
    <div
      className={cn(
        "mt-3 flex items-center gap-2 px-2.5 pb-1 first:mt-0",
        collapsed && "lg:justify-center lg:px-0",
      )}
      title={label}
    >
      <AppWindow size={12} className="shrink-0 text-muted" />
      <span className={cn("truncate text-[10.5px] font-semibold tracking-wide text-muted", collapsed && "lg:hidden")}>
        {label}
      </span>
      <span className={cn("h-px flex-1 bg-line", collapsed && "lg:hidden")} />
    </div>
  );
}

/** 把分段按应用顺序渲染；空段已在纯逻辑层剪掉，这里不会再出现空标题。 */
function NavSections({
  sections,
  collapsed,
  ...treeProps
}: Omit<NavTreeProps, "nodes" | "level" | "collapsed"> & {
  sections: NavSection[];
  collapsed: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-0.5">
          {section.showHeader && <AppSectionHeader label={section.label} collapsed={collapsed} />}
          <NavTree {...treeProps} nodes={section.nodes} level={0} collapsed={collapsed} />
        </div>
      ))}
    </div>
  );
}

interface NavTreeProps {
  nodes: NavNode[];
  level: number;
  collapsed: boolean;
  expanded: Set<string>;
  matchedId?: string;
  onToggle: (id: string) => void;
  onExpandFromCollapsed: (id: string) => void;
  onNavigate: () => void;
  showTooltip: (label: string, group: string, element: HTMLElement) => void;
  hideTooltip: () => void;
}

/**
 * 递归渲染侧栏：目录节点是可折叠分组，叶子节点只有可导航时才出现。
 * 层级由 treeCode 前缀推导，不再限制两级。
 */
function NavTree({
  nodes,
  level,
  collapsed,
  expanded,
  matchedId,
  onToggle,
  onExpandFromCollapsed,
  onNavigate,
  showTooltip,
  hideTooltip,
}: NavTreeProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", level > 0 && "ml-2.5 border-l border-line pl-2")}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const Icon = node.icon;
        const active = matchedId === node.id;
        const groupLabel = node.trail.length > 0 ? node.trail.join(" / ") : "顶层菜单";
        // 既能挂在 button 也能挂在 a / Link 上；currentTarget 只取公共的 HTMLElement。
        const tooltipProps = collapsed
          ? {
              "aria-label": node.label,
              onMouseEnter: (event: { currentTarget: HTMLElement }) => showTooltip(node.label, groupLabel, event.currentTarget),
              onMouseLeave: hideTooltip,
              onFocus: (event: { currentTarget: HTMLElement }) => showTooltip(node.label, groupLabel, event.currentTarget),
              onBlur: hideTooltip,
            }
          : {};
        const toggle = () => (collapsed ? onExpandFromCollapsed(node.id) : onToggle(node.id));

        if (hasChildren) {
          const isOpen = expanded.has(node.id);
          const groupClass = cn(
            "flex min-h-[34px] flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
            active ? "text-accent-strong" : "text-muted hover:bg-sunken hover:text-ink",
            collapsed && "lg:h-10 lg:justify-center lg:gap-0 lg:px-0 lg:py-0",
          );
          const groupInner = (
            <>
              <Icon size={14} className={active ? "text-accent" : "text-muted"} />
              <span className={cn("flex-1 truncate text-left", collapsed && "lg:hidden")}>{node.label}</span>
            </>
          );
          return (
            <div key={node.id} className={cn("flex flex-col gap-0.5", level === 0 && "mt-1 first:mt-0")}>
              <div className="flex items-center gap-0.5">
                {/*
                 * 既是页面又是父目录的节点必须两个入口都保留：
                 * 名称部分跳页面，右侧箭头只负责折叠 / 展开。
                 */}
                {node.navigable ? (
                  node.external ? (
                    <a
                      href={node.path}
                      target="_blank"
                      rel="noreferrer"
                      onClick={onNavigate}
                      className={groupClass}
                      aria-current={active ? "page" : undefined}
                      {...tooltipProps}
                    >
                      {groupInner}
                      <ExternalLink size={12} className="text-muted" />
                    </a>
                  ) : (
                    <Link
                      to={node.path}
                      onClick={onNavigate}
                      className={groupClass}
                      aria-current={active ? "page" : undefined}
                      {...tooltipProps}
                    >
                      {groupInner}
                    </Link>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={toggle}
                    title={collapsed ? `${node.label}（点击展开侧栏）` : node.label}
                    className={groupClass}
                    {...tooltipProps}
                  >
                    {groupInner}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={!collapsed && isOpen}
                  aria-label={`${isOpen ? "折叠" : "展开"}${node.label}的子菜单`}
                  className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink"
                >
                  <ChevronDown size={12} className={cn("transition-transform", !isOpen && "-rotate-90")} />
                </button>
              </div>
              {/* 折叠态没有空间展示缩进子级，改为点击箭头时展开整条侧栏 */}
              {isOpen && !collapsed && (
                <NavTree
                  nodes={node.children}
                  level={level + 1}
                  collapsed={collapsed}
                  expanded={expanded}
                  matchedId={matchedId}
                  onToggle={onToggle}
                  onExpandFromCollapsed={onExpandFromCollapsed}
                  onNavigate={onNavigate}
                  showTooltip={showTooltip}
                  hideTooltip={hideTooltip}
                />
              )}
            </div>
          );
        }

        // 目录节点（不可导航）且没有子级时没有展示价值，直接跳过。
        if (!node.navigable) return null;

        const className = cn(
          "relative flex min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors",
          active ? "bg-accent-soft text-accent-strong" : "text-ink-soft hover:bg-sunken hover:text-ink",
          collapsed && "lg:h-10 lg:justify-center lg:gap-0 lg:px-0 lg:py-0",
        );
        const inner = (
          <>
            <Icon size={15} className={active ? "text-accent" : "text-muted"} />
            <span className={cn("truncate", collapsed && "lg:hidden")}>{node.label}</span>
            {node.external && <ExternalLink size={12} className={cn("text-muted", collapsed && "lg:hidden")} />}
            {active && <span className={cn("ml-auto h-1.5 w-1.5 rounded-full bg-accent", collapsed && "lg:hidden")} />}
            {active && collapsed && (
              <span className="absolute left-0 top-1/2 hidden h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent lg:block" />
            )}
          </>
        );
        const linkProps: ComponentProps<"a"> = collapsed
          ? {
              "aria-label": node.label,
              onMouseEnter: (event) => showTooltip(node.label, groupLabel, event.currentTarget),
              onMouseLeave: hideTooltip,
              onFocus: (event) => showTooltip(node.label, groupLabel, event.currentTarget),
              onBlur: hideTooltip,
            }
          : {};
        return node.external ? (
          <a
            key={node.id}
            href={node.path}
            target="_blank"
            rel="noreferrer"
            onClick={onNavigate}
            className={className}
            aria-current={active ? "page" : undefined}
            {...linkProps}
          >
            {inner}
          </a>
        ) : (
          <Link
            key={node.id}
            to={node.path}
            onClick={onNavigate}
            className={className}
            aria-current={active ? "page" : undefined}
            {...linkProps}
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell() {
  const { session, authz, authzError, authzLoading, logout, refreshAuthz, hasPerm } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [tooltip, setTooltip] = useState<{ label: string; group: string; top: number } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // 应用名只用于分组标题；接口失败也能继续按 appId 分组（回退成短 ID），不阻断侧栏。
  const appsQuery = useAppOptions(Boolean(authz?.menus?.length));
  const sections = useMemo(
    () => buildNavSections(authz?.menus ?? [], appsQuery.data ?? []),
    [authz?.menus, appsQuery.data],
  );
  // 分段已经是剪枝后的结果，展平只用于路径匹配；有节点就一定有可展示入口。
  const navTree = useMemo(() => sectionNodes(sections), [sections]);
  const matched = useMemo(() => findNavTrail(navTree, location.pathname), [navTree, location.pathname]);
  const hasVisibleEntries = navTree.length > 0;
  const roleNames = authz?.roles.map((role) => role.name) ?? [];

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* 隐私模式 / 存储禁用时忽略 */
    }
    setTooltip(null);
  }, [collapsed]);

  // 深链进来时自动展开当前页面所在的整条分支。
  useEffect(() => {
    if (!matched || matched.ancestorIds.length === 0) return;
    setExpanded((current) => {
      const next = new Set(current);
      let changed = false;
      for (const id of matched.ancestorIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [matched]);

  const showTooltip = (label: string, group: string, element: HTMLElement) => {
    if (!collapsed) return;
    const rect = element.getBoundingClientRect();
    setTooltip({ label, group, top: rect.top + rect.height / 2 });
  };

  const hideTooltip = () => setTooltip(null);

  const toggleNode = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandFromCollapsed = (id: string) => {
    setCollapsed(false);
    setExpanded((current) => new Set(current).add(id));
    hideTooltip();
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

        <nav aria-label="主导航" className={cn("flex-1 overflow-y-auto px-2.5 py-3", collapsed && "lg:px-2")}>
          {!hasVisibleEntries ? (
            <div className={cn("px-2 py-3 text-[11.5px] leading-relaxed text-muted", collapsed && "lg:hidden")}>
              当前账号没有可见菜单。
            </div>
          ) : (
            <NavSections
              sections={sections}
              collapsed={collapsed}
              expanded={expanded}
              matchedId={matched?.node.id}
              onToggle={toggleNode}
              onExpandFromCollapsed={expandFromCollapsed}
              onNavigate={() => setMobileOpen(false)}
              showTooltip={showTooltip}
              hideTooltip={hideTooltip}
            />
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
              <nav aria-label="面包屑" className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                {matched.trail.map((label, index) => (
                  <span key={`${label}-${index}`} className="inline-flex items-center gap-1.5">
                    <span className="truncate">{label}</span>
                    <ChevronRight size={12} />
                  </span>
                ))}
                <span className="truncate font-medium text-ink">{matched.node.label}</span>
              </nav>
            ) : location.pathname === "/profile" ? (
              <nav aria-label="面包屑" className="flex items-center gap-1.5 text-[12px] text-muted">
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
          {/* 旧会话没有该字段时不误报，只有明确为 false 才提示 */}
          {session?.auditPswdSet === false && (
            <div className="hidden sm:block">
              <Badge tone="warn">未设审核口令</Badge>
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
            当前账号仍在使用初始口令，请尽快到
            <Link to="/profile" className="mx-1 underline underline-offset-2">
              个人中心
            </Link>
            修改。
          </div>
        )}

        {session?.auditPswdSet === false && (
          <div className="border-b border-warn/30 bg-warn-soft px-4 py-2 text-[12px] text-warn">
            当前账号尚未设置审核口令，执行删除校验等审核操作前需要先设置。
            {hasPerm("GET:/adm/user") ? (
              <>
                请到
                <Link to="/users" className="mx-1 underline underline-offset-2">
                  用户管理
                </Link>
                编辑当前账号补充审核口令。
              </>
            ) : (
              "请联系管理员在「用户管理」中为本账号补充审核口令。"
            )}
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
          <span>Adm Console</span>
          <span>账号 · 角色 · 菜单 · 权限</span>
        </footer>
      </div>
    </div>
  );
}

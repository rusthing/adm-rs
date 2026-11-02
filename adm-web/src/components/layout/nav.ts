import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  FileText,
  FolderTree,
  Gauge,
  Globe2,
  KeyRound,
  Layers,
  LayoutGrid,
  LogIn,
  Menu as MenuIcon,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  UserCog,
  UserCircle,
  Users,
} from "lucide-react";
import type { AdmMenuVo } from "@/lib/types";

/**
 * 菜单 `component` 与前端页面组件的映射约定：
 *
 * - `component` 为空：目录节点，只作为侧栏分组，不注册路由；
 * - `component` 非空：对应 `App.tsx` 里 `PAGE_COMPONENTS` 的键，按该键挂载页面；
 * - 后端下发了前端未注册的 `component`：降级为「未注册页面」占位，不抛错、不整页崩。
 *
 * 新增页面时只需在两处登记：本文件的图标映射（可选）与 `App.tsx` 的组件表。
 */
export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  component?: string;
  linkType: number;
  /** 外链 / iframe 不走前端路由，直接打开原 URL */
  external: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutGrid,
  gauge: Gauge,
  shield: Shield,
  users: Users,
  "user-cog": UserCog,
  menu: MenuIcon,
  "key-round": KeyRound,
  settings: Settings,
  "folder-tree": FolderTree,
  layers: Layers,
  globe: Globe2,
  "app-window": AppWindow,
  "file-text": FileText,
  "log-in": LogIn,
  "scroll-text": ScrollText,
  "shield-check": ShieldCheck,
  "user-circle": UserCircle,
};

function iconOf(name?: string): LucideIcon {
  return (name && ICONS[name]) || LayoutGrid;
}

function toItem(menu: AdmMenuVo): NavItem {
  return {
    id: menu.id,
    label: menu.name,
    path: menu.path || "/",
    icon: iconOf(menu.icon),
    component: menu.component || undefined,
    linkType: menu.linkType,
    external: menu.linkType === 2 || menu.linkType === 3,
  };
}

/**
 * 用后端 `GET /adm/auth/me` 返回的菜单树（已按 role-menu 过滤）构建侧栏。
 *
 * 约定两层结构：`treeCode` 长度 3 为分组目录，长度 6 为其下的菜单项；
 * 没有父目录的可见菜单统一放进「其他」分组，避免直接丢弃。
 */
export function buildNav(menus: AdmMenuVo[]): NavGroup[] {
  const visible = menus
    .filter((menu) => menu.enabled !== false && menu.visible !== false)
    .sort((a, b) => a.treeCode.localeCompare(b.treeCode));

  const roots = visible.filter((menu) => menu.treeCode.length === 3);
  const groups: NavGroup[] = [];
  const consumed = new Set<string>();

  for (const root of roots) {
    const children = visible.filter(
      (menu) => menu.treeCode.length === 6 && menu.treeCode.startsWith(root.treeCode),
    );
    const items: NavItem[] = [];
    if (root.component || root.linkType !== 1) items.push(toItem(root));
    for (const child of children) {
      if (child.component || child.linkType !== 1) items.push(toItem(child));
      consumed.add(child.id);
    }
    if (items.length > 0) groups.push({ label: root.name, items });
    consumed.add(root.id);
  }

  const rest = visible.filter(
    (menu) => !consumed.has(menu.id) && (menu.component || menu.linkType !== 1),
  );
  if (rest.length > 0) groups.push({ label: "其他", items: rest.map(toItem) });

  return groups;
}

export function navItems(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((group) => group.items);
}

export function findNav(
  groups: NavGroup[],
  pathname: string,
): { group: NavGroup; item: NavItem } | null {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.external) continue;
      if (
        item.path === "/"
          ? pathname === "/"
          : pathname === item.path || pathname.startsWith(`${item.path}/`)
      ) {
        return { group, item };
      }
    }
  }
  return null;
}

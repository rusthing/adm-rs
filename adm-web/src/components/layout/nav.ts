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
import { isRegisteredComponent } from "@/pages/registry";

/**
 * 菜单 `component` 与前端页面组件的映射约定：
 *
 * - `component` 为空：目录节点，只作为侧栏分组，不注册路由；
 * - `component` 非空且已在 `pages/registry.ts` 登记：按该键挂载页面并出现在侧栏；
 * - 后端下发了前端未登记的 `component`：**不进侧栏**，直接访问 URL 时才显示
 *   「未登记页面」占位，避免用户点进一个必然不可用的入口。
 *
 * 新增页面时只需在两处登记：本文件的图标映射（可选）与 `pages/registry.ts` 的组件表。
 */

export interface NavNode {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  component?: string;
  linkType: number;
  /** 外链 / iframe 不走前端路由，直接打开原 URL */
  external: boolean;
  /** 是否可点击：外链与已登记组件的内链为 true，目录节点为 false。 */
  navigable: boolean;
  depth: number;
  children: NavNode[];
  /** 从最顶层分组到父级的名称链（不含自身），用于面包屑与折叠态 tooltip。 */
  trail: string[];
  /** 从最顶层分组到父级的 id 链，用于自动展开当前所在分支。 */
  ancestorIds: string[];
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

/** 图标名白名单：菜单表单的图标下拉只能从这些值里选，避免自由文本写出无效图标。 */
export const ICON_NAMES: string[] = Object.keys(ICONS).sort();

export function iconOf(name?: string): LucideIcon {
  return (name && ICONS[name]) || LayoutGrid;
}

function navigableOf(menu: AdmMenuVo): boolean {
  // 外链 / iframe 可直接生成入口；内链必须已登记组件，且不能是空 component 的目录。
  return menu.linkType !== 1 ? true : isRegisteredComponent(menu.component);
}

/**
 * 用 `treeCode` 的**前缀关系**构造任意层级侧栏树。
 *
 * 后端约定每层 3 位、总长 3..=30（最多 10 层），所以不能再按长度 3/6 写死两级。
 * 父目录被隐藏或未授权时，子节点逐级向上找最近的可见祖先并挂过去；
 * 一个可见祖先都没有就上提为根节点，保证菜单不会因为中间层缺失而整条消失。
 */
export function buildNavTree(menus: AdmMenuVo[]): NavNode[] {
  const visible = menus
    .filter((menu) => menu.enabled !== false && menu.visible !== false)
    .slice()
    .sort((a, b) => a.treeCode.localeCompare(b.treeCode));

  const byCode = new Map<string, AdmMenuVo>();
  for (const menu of visible) byCode.set(menu.treeCode, menu);

  const nodes = new Map<string, NavNode>();
  for (const menu of visible) {
    nodes.set(menu.id, {
      id: menu.id,
      label: menu.name,
      path: menu.path || "/",
      icon: iconOf(menu.icon),
      component: menu.component || undefined,
      linkType: menu.linkType,
      external: menu.linkType === 2 || menu.linkType === 3,
      navigable: navigableOf(menu),
      // 真正的层级在下面按可见父链计算：中间层被隐藏/未授权时不应凭空跳一级。
      depth: 0,
      children: [],
      trail: [],
      ancestorIds: [],
    });
  }

  const roots: NavNode[] = [];
  for (const menu of visible) {
    const node = nodes.get(menu.id)!;
    let code = menu.treeCode;
    let parent: NavNode | null = null;
    // 逐级剥掉最后一层，直到找到一个可见的祖先；用 byCode 而不是 id，
    // 因为 treeCode 才是层级关系的唯一依据。
    while (code.length > 3) {
      code = code.slice(0, -3);
      const candidate = byCode.get(code);
      if (candidate && candidate.id !== menu.id) {
        parent = nodes.get(candidate.id) ?? null;
        break;
      }
    }
    if (parent) {
      node.trail = [...parent.trail, parent.label];
      node.ancestorIds = [...parent.ancestorIds, parent.id];
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** 深度优先展开所有节点，便于统计与单测。 */
export function flattenNav(nodes: NavNode[]): NavNode[] {
  const result: NavNode[] = [];
  const walk = (list: NavNode[]) => {
    for (const node of list) {
      result.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

function pathMatches(path: string, pathname: string): boolean {
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * 找到当前地址对应的菜单节点，取**最长路径匹配**：
 * 三级菜单 `/system/users/list` 不应被父级 `/system` 抢先命中。
 * 返回节点及其祖先名称链，供面包屑与自动展开使用。
 */
export function findNavTrail(
  nodes: NavNode[],
  pathname: string,
): { node: NavNode; trail: string[]; ancestorIds: string[] } | null {
  const matched: Array<{ node: NavNode; score: number }> = [];
  const walk = (list: NavNode[]) => {
    for (const node of list) {
      if (!node.external && pathMatches(node.path, pathname)) {
        matched.push({ node, score: node.path === "/" ? 0 : node.path.length });
      }
      walk(node.children);
    }
  };
  walk(nodes);
  matched.sort((a, b) => b.score - a.score);
  const top = matched[0];
  return top
    ? { node: top.node, trail: top.node.trail, ancestorIds: top.node.ancestorIds }
    : null;
}

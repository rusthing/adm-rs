import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  Building2,
  FileText,
  FolderTree,
  Gauge,
  Globe2,
  IdCard,
  KeyRound,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  ListTree,
  Lock,
  LogIn,
  Menu as MenuIcon,
  Network,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  UserCog,
  UserCircle,
  UserRound,
  Users,
} from "lucide-react";
import type { AdmMenuVo } from "@/lib/types";
import { isRegisteredComponent } from "@/pages/registry";
import { shortId } from "@/lib/utils";

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
  /** 从最顶层分组（含应用名）到父级的名称链（不含自身），用于面包屑与折叠态 tooltip。 */
  trail: string[];
  /** 从最顶层分组到父级的 id 链，用于自动展开当前所在分支。 */
  ancestorIds: string[];
}

/** 侧栏按应用分组所需的最小应用信息；`AdmAppVo` 结构上天然满足。 */
export interface NavAppInfo {
  id: string;
  name: string;
  sortOrder?: number;
}

/**
 * 侧栏的一段。多个应用时每段带一个应用标题；只有一个 / 没有应用时
 * 合并成一段且不显示标题，保持原先紧凑的单树形态。
 */
export interface NavSection {
  id: string;
  label: string;
  /** 是否渲染应用分组头；由「可见菜单里 distinct appId 的数量」动态决定。 */
  showHeader: boolean;
  /** 已完成空目录剪枝的菜单树。 */
  nodes: NavNode[];
}

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutGrid,
  "layout-template": LayoutTemplate,
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
  lock: Lock,
  "scroll-text": ScrollText,
  "shield-check": ShieldCheck,
  "user-circle": UserCircle,
  // 组织与人员这一组：种子菜单用的就是这几个名字，缺一个就会退回默认图标，
  // 结果五个页面图标长得一样、跟「概览」也分不开。
  "building-2": Building2,
  network: Network,
  hierarchy: ListTree,
  profile: UserRound,
  "id-card": IdCard,
};

/** 图标名白名单：菜单表单的图标下拉只能从这些值里选，避免自由文本写出无效图标。 */
export const ICON_NAMES: string[] = Object.keys(ICONS).sort();

export function iconOf(name?: string): LucideIcon {
  return (name && ICONS[name]) || LayoutGrid;
}

/** 目录节点即使配了 component，也必须同时有路径才可点；外链没有 URL 同样是坏入口。 */
function navigableOf(menu: AdmMenuVo): boolean {
  const path = (menu.path ?? "").trim();
  if (!path) return false;
  // 外链 / iframe 可直接生成入口；内链必须已登记组件，且不能是空 component 的目录。
  return menu.linkType !== 1 ? true : isRegisteredComponent(menu.component);
}

/** treeCode 只在 `(appId, treeCode)` 下唯一，跨应用不能互相认父。 */
function codeKey(appId: string, treeCode: string): string {
  return `${appId}\u0000${treeCode}`;
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
    .sort((a, b) => a.treeCode.localeCompare(b.treeCode) || a.id.localeCompare(b.id));

  // 按 appId 隔离：两个应用都叫 001 / 001001 时绝不能串成同一棵树。
  const byCode = new Map<string, AdmMenuVo>();
  for (const menu of visible) byCode.set(codeKey(menu.appId, menu.treeCode), menu);

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
    // 逐级剥掉最后一层，直到找到一个同应用下的可见祖先；用 treeCode 而不是 id，
    // 因为它才是层级关系的唯一依据。
    while (code.length > 3) {
      code = code.slice(0, -3);
      const candidate = byCode.get(codeKey(menu.appId, code));
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

/**
 * 自底向上剪掉「既不可点、又没有可展示后代」的目录节点。
 *
 * 只判断 `children.length > 0` 是不够的：子目录也可能整棵是空壳，
 * 剪完之后父目录同样变成空壳，必须逐层回收，否则侧栏会留下一排点不开的标题。
 */
export function pruneNav(nodes: NavNode[]): NavNode[] {
  const result: NavNode[] = [];
  for (const node of nodes) {
    const children = pruneNav(node.children);
    if (!node.navigable && children.length === 0) continue;
    result.push(children.length === node.children.length ? node : { ...node, children });
  }
  return result;
}

/** 给整棵树的 trail 前置应用名，让面包屑与折叠态 tooltip 带上所属应用。 */
function prefixTrail(nodes: NavNode[], prefix: string): NavNode[] {
  return nodes.map((node) => ({
    ...node,
    trail: [prefix, ...node.trail],
    children: prefixTrail(node.children, prefix),
  }));
}

/**
 * 按应用切分侧栏，并动态决定是否显示分组头：
 *
 * - 可见菜单里 **0 或 1 个应用** → 合为一段、无标题（用户看到的就是原来的单树）；
 * - **2 个及以上应用** → 每个应用一段、带应用标题；
 * - 某应用剪枝后没有任何可展示节点 → 整段隐藏，不留空标题。
 *
 * 判断依据是「当前账号可见菜单里的 distinct appId」，而不是系统里应用总数：
 * 用户只看得到一个应用时，再显示分组头没有意义。
 */
export function buildNavSections(menus: AdmMenuVo[], apps: NavAppInfo[] = []): NavSection[] {
  const appIds: string[] = [];
  const seen = new Set<string>();
  for (const menu of menus) {
    if (menu.enabled === false || menu.visible === false) continue;
    if (seen.has(menu.appId)) continue;
    seen.add(menu.appId);
    appIds.push(menu.appId);
  }

  if (appIds.length <= 1) {
    const nodes = pruneNav(buildNavTree(menus));
    return nodes.length > 0
      ? [{ id: "__all__", label: "", showHeader: false, nodes }]
      : [];
  }

  // apps 已由调用方按 sort_order 排好序，直接用下标当权重；未查到的应用排最后。
  const byId = new Map(apps.map((app) => [app.id, app]));
  const order = new Map(apps.map((app, index) => [app.id, index]));
  const rank = (id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER;
  const ordered = [...appIds].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  const sections: NavSection[] = [];
  for (const appId of ordered) {
    const label = byId.get(appId)?.name || `应用 ${shortId(appId)}`;
    const nodes = pruneNav(buildNavTree(menus.filter((menu) => menu.appId === appId)));
    if (nodes.length === 0) continue;
    sections.push({
      id: appId,
      label,
      showHeader: true,
      nodes: prefixTrail(nodes, label),
    });
  }
  return sections;
}

/** 把所有分段展平成一棵树，供路径匹配使用。 */
export function sectionNodes(sections: NavSection[]): NavNode[] {
  return sections.flatMap((section) => section.nodes);
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
      if (!node.external && node.navigable && pathMatches(node.path, pathname)) {
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
